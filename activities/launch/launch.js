(function($) {
    // Activity default options
    var defaults = {
        name        : "launch",                            // The activity name
        label       : "Launch",                            // The activity label
        template    : "template.html",                          // Activity's html template
        css         : "style.css",                              // Activity's css style sheet
        lang        : "en-US",                                  // Current localization
        exercice    : [],                                       // Exercice
        wheel       : [260,410],                                // Wheel position
        bubble      : [40,34],
        wall        : [100,20],
        level       : 0,
        tip         : true,
        board       : "",                                       // board
        change      : 9,
        debug       : true                                      // Debug mode
    };


    
    var regExp = [
        "\\\[b\\\]([^\\\[]+)\\\[/b\\\]",            "<b>$1</b>",
        "\\\[i\\\]([^\\\[]+)\\\[/i\\\]",            "<i>$1</i>",
        "\\\[br\\\]",                               "<br/>",
        "\\\[blue\\\]([^\\\[]+)\\\[/blue\\\]",      "<span style='color:blue'>$1</span>",
        "\\\[red\\\]([^\\\[]+)\\\[/red\\\]",        "<span style='color:red'>$1</span>",
        "\\\[strong\\\](.+)\\\[/strong\\\]",        "<div class='strong'>$1</div>"
    ];
    
    var colors = [ "black","white","blue","green","yellow","purple","red","orange"];
    var touch = { none:0, ball:1, wall:2, top:3 };
    
    var fps = 20;

    // private methods
    var helpers = {
        // @generic: Check the context
        checkContext: function(_settings){
            var ret         = "";
            if (!_settings.context)         { ret = "no context is provided in the activity call."; } else
            if (!_settings.context.onquit)  { ret = "mandatory callback onquit not available."; }

            if (ret.length) {
                ret+="\n\nUsage: $(\"target\")."+_settings.name+"({'onquit':function(_ret){}})";
            }
            return ret;
        },
        // Get the settings
        settings: function($this, _val) { if (_val) { $this.data("settings", _val); } return $this.data("settings"); },
        // Binding clear
        unbind: function($this) {
            $(document).unbind("keypress keydown");
            $this.unbind("mouseup mousedown mousemove mouseout touchstart touchmove touchend touchleave");
        },
        // Quit the activity by calling the context callback
        end: function($this) {
            var settings = helpers.settings($this);
            helpers.unbind($this);
            settings.context.onquit($this,{'status':'success','score':settings.score});
        },
        format: function(_text) {
            for (var j=0; j<2; j++) for (var i=0; i<regExp.length/2; i++) {
                var vReg = new RegExp(regExp[i*2],"g");
                _text = _text.replace(vReg,regExp[i*2+1]);
            }
            return _text;
        },
        loader: {
            css: function($this) {
                var settings = helpers.settings($this), cssAlreadyLoaded = false, debug = "";
                if (settings.debug) { var tmp = new Date(); debug="?time="+tmp.getTime(); }

                $("head").find("link").each(function() {
                    if ($(this).attr("href").indexOf("activities/"+settings.name+"/"+settings.css) != -1) { cssAlreadyLoaded = true; }
                });

                if(cssAlreadyLoaded) { helpers.loader.template($this); }
                else {
                    $("head").append("<link></link>");
                    var css = $("head").children(":last");
                    var csspath = "activities/"+settings.name+"/"+settings.css+debug;

                    css.attr({ rel:  "stylesheet", type: "text/css", href: csspath }).ready(
                        function() { helpers.loader.template($this); });
                }
            },
            template: function($this) {
                var settings = helpers.settings($this), debug = "";
                if (settings.debug) { var tmp = new Date(); debug="?time="+tmp.getTime(); }

                // Load the template
                var templatepath = "activities/"+settings.name+"/"+settings.template+debug;
                $this.load( templatepath, function(response, status, xhr) { helpers.loader.svg($this); });
            },
            // Load the svg if require
            svg:function($this) {
                var settings = helpers.settings($this),debug = "";
                if (settings.debug) { var tmp = new Date(); debug="?time="+tmp.getTime(); }
                var elt= $("<div></div>").appendTo($this.find("#board"));
                elt.svg();
                settings.svg = elt.svg('get');
                settings.svg.load('res/img/desktop/bubble01.svg' + debug,
                    { addTo: true, changeSize: true, onLoad:function() { helpers.loader.build($this); }
                });
            },
            build: function($this) {
                var settings = helpers.settings($this);

                // Send the onLoad callback
                if (settings.context.onload) { settings.context.onload($this); }

                $this.css("font-size", ($this.height()/12)+"px");
                
                $this.bind("touchstart mousedown", function(_event) {
                    var e = (_event && _event.originalEvent &&
                             _event.originalEvent.touches && _event.originalEvent.touches.length)?
                             _event.originalEvent.touches[0]:_event;

                    if (settings.interactive) {
                        if (!settings.ratio) {
                            settings.ratio  = 640/$(this).width();
                            settings.offset = [$(this).offset().left, $(this).offset().top];
                        }
                        var x = (e.clientX - settings.offset[0])*settings.ratio;
                        var y = (e.clientY - settings.offset[1])*settings.ratio;

                        if (x>=100 && x<420) {
                            if (y<380) {
                                settings.action.first   = [ e.clientX, y ];
                                settings.action.last    = [ e.clientX, e.clientY ];
                                settings.action.angle   = settings.angle;
                                if (settings.tip) { $("#tip",settings.svg.root()).show(); }
                            }
                            else {
                                if (settings.tip) { $("#tip",settings.svg.root()).hide(); }
                                settings.interactive = false;
                                settings.action.path = helpers.path($this,settings.wheel, settings.action.angle);
                                settings.current.moveto(settings.action.path, 400, function() {
                                    // FIND THE CLOSEST HOLES
                                    var dd, pp=0;
                                    for (var j=0; j<(10+1); j++) for (var i=0; i<8; i++) {
                                        if (!settings.data[j][i]) {
                                            var pos = helpers.ijtopos($this, i,j);
                                            var d   = (settings.current.pos[0]-pos[0])*(settings.current.pos[0]-pos[0]) +
                                                      (settings.current.pos[1]-pos[1])*(settings.current.pos[1]-pos[1]);
                                            if (pp==0 || d<dd) { dd=d; pp = [i,j]; }
                                        }
                                        else { settings.data[j][i].tmp = 0; }
                                    }
                                    settings.data[pp[1]][pp[0]]=settings.current;
                                    var check = [[pp[0],pp[1]]];

                                    setTimeout(function() {
                                        helpers.display($this);
                                        var elts=[];
                                        do {
                                            var pos = check.shift();
                                            var e = helpers.getbubble($this, pos );
                                            if (e && e.tmp==0 && e.val==settings.current.val) {
                                                elts.push([e,pos[1]]);
                                                e.tmp = 1;
                                                check.push([pos[0]-1, pos[1]]);
                                                check.push([pos[0]+1, pos[1]]);
                                                check.push([pos[0], pos[1]-1]);
                                                check.push([pos[0]+(pos[1]%2?1:-1), pos[1]-1]);
                                                check.push([pos[0], pos[1]+1]);
                                                check.push([pos[0]+(pos[1]%2?1:-1), pos[1]+1]);
                                            }
                                        } while(check.length);
                                        if (elts.length>2) {
                                            for (var j=0; j<(10+1); j++) for (var i=0; i<8; i++) {
                                                var e = helpers.getbubble($this, [i,j] );
                                                if (e) { e.tmp = 0; }
                                            }
                                            do {
                                                var elt = elts.shift(), e = elt[0];
                                                e.remove = true; e.tmp = 1;
                                                e.$svg.attr("class","bubble fx");
                                            } while (elts.length);
                                            check = [];
                                            for (var i=0; i<8; i++) {
                                                var e = helpers.getbubble($this, [i,0] );
                                                if (e && !e.remove) { check.push([i,0]); }
                                            }
                                            var finish = !(check.length);
                                            while (check.length) {
                                                var pos = check.shift();
                                                var e = helpers.getbubble($this, pos );
                                                if (e && e.tmp==0) {
                                                    e.tmp = 1;
                                                    check.push([pos[0]-1, pos[1]]);
                                                    check.push([pos[0]+1, pos[1]]);
                                                    check.push([pos[0], pos[1]-1]);
                                                    check.push([pos[0]+(pos[1]%2?1:-1), pos[1]-1]);
                                                    check.push([pos[0], pos[1]+1]);
                                                    check.push([pos[0]+(pos[1]%2?1:-1), pos[1]+1]);
                                                }
                                            };
                                            
                                            for (var j=0; j<(10+1); j++) for (var i=0; i<8; i++) {
                                                var e = helpers.getbubble($this, [i,j] );
                                                if (e && (e.tmp==0 || e.remove)) {
                                                    settings.data[j][i] = 0;
                                                    var path=[];
                                                    path.push([e.pos[0],e.pos[1]]);
                                                    path.push([e.pos[0],e.pos[1]+480]);
                                                    e.moveto(path,400+j*40, function() { this.$svg.detach(); });
                                                }
                                            }
                                            
                                            if (finish) { settings.score = 5; setTimeout(function() { helpers.end($this);}, 1000 ); }
                                            else        { setTimeout(function() { helpers.run($this);}, 1000 ); }

                                        }
                                        else { helpers.run($this); }
                                    }, 100);
                                    
                                });
                            }
                        }
                        
                        helpers.tip($this);
                    }
                    _event.preventDefault();
                });
                
                $this.bind("touchend mouseup", function(_event) {
                    if (settings.interactive && settings.action.last ) {
                        settings.angle = settings.action.angle;
                    }
                    settings.action.last = 0;
                    _event.preventDefault();
                });
                
                $this.bind("mousemove touchmove", function(_event) {
                    if (settings.interactive && settings.action.last ) {
                        var e = (_event && _event.originalEvent &&
                             _event.originalEvent.touches && _event.originalEvent.touches.length)?
                             _event.originalEvent.touches[0]:_event;

                        settings.action.angle = settings.angle +
                            (e.clientX - settings.action.first[0])*settings.ratio*settings.action.first[1]/430;
                        
                        if (settings.action.angle>70) { settings.action.angle = 70; } else
                        if (settings.action.angle<-70){ settings.action.angle =-70; }
                        
                        $("#wheel #rotate").attr("transform","rotate("+settings.action.angle+")");
                        
                        helpers.tip($this);

                    }
                    _event.preventDefault();
                });
                
                $("#wheel",settings.svg.root()).attr("transform","translate("+settings.wheel[0]+","+settings.wheel[1]+")");
                
                var index = 0;
                for (var j=0; j<(10+1); j++) {
                    var line = [];
                    for (var i=0; i<8; i++) {
                        if (i<7 || j%2==0)
                        {
                            var elt = 0;
                            var val = index<settings.board.length?settings.board[index]:' ';
                            if (val!=' ' && val!='-') { elt = helpers.bubble($this, parseInt(val)); }
                            line.push(elt);
                        
                            index++;
                        }
                    }
                    settings.data.push(line);
                }
                helpers.next($this);
                helpers.display($this);
                    
                // Locale handling
                $this.find("h1#label").html(settings.label);
                if (settings.locale) { $.each(settings.locale, function(id,value) {
                    if ($.isArray(value)) {  for (var i in value) { $this.find("#"+id).append("<p>"+value[i]+"</p>"); } }
                    else { $this.find("#"+id).html(value); }
                }); }

                if (!$this.find("#splashex").is(":visible")) { setTimeout(function() { $this[settings.name]('next'); }, 500); }
            }
        },
        getbubble: function($this, _pos) {
            var settings = helpers.settings($this);
            return (_pos[0]>=0 && _pos[0]<8 && _pos[1]>=0 && _pos[1]<(10+1))?settings.data[_pos[1]][_pos[0]]:0;
        },
        tip: function($this) {
            var settings = helpers.settings($this);
            if (settings.tip) {
                settings.action.path = helpers.path($this,settings.wheel, settings.action.angle);
                var d = "M ";
                for (var i=0; i<settings.action.path.length; i++) {
                    if (i) { d+=" L "; }
                    d+=settings.action.path[i][0]+","+settings.action.path[i][1];
                }
                        
                $("#tip path",settings.svg.root()).attr("d",d);
                var last = settings.action.path[settings.action.path.length-1];
                $("#tip circle",settings.svg.root()).attr("cx",last[0]).attr("cy",last[1]).attr("r",settings.bubble[0]/2);  
            }
        },
        path: function($this, _pos, _angle) {
            var settings = helpers.settings($this);
            var ret=[[_pos[0],_pos[1]]];
            
            do {
                var touch = false;
                var ss = [0,0];
                var x1 = settings.wall[0]+settings.bubble[0]/2;
                var x2 = x1 + (8-1)*settings.bubble[0];
                var lines = 0;
                for (var j=9; j>=0; j--) {
                    for (var i=0; i<8; i++) {
                        var e=settings.data[j][i];
                        if (e) {
                            var s = e.inter(_pos, _angle);
                            if (s && s[1]>ss[1]) { ss=s; }
                        }
                    }
                    if (ss[1] && ss[0]>=x1 && ss[0]<=x2) { lines++; }
                    if (lines==2) { break; }
                }
                if (ss[1] && ss[0]>=x1 && ss[0]<=x2) { ret.push(ss); touch = true;}
                else {
                    $("#output").html("");
                    var y = settings.wall[1]+settings.bubble[0]/2+settings.bubble[1]*settings.level-_pos[1];
                    if (_angle>0) {
                        var angletop = Math.atan((_pos[0]-x2)/y);
                        var angle = Math.PI*_angle/180;
                        if (angle<angletop) { ret.push([_pos[0]-Math.tan(angle)*y, _pos[1]+y]); touch = true; } 
                        else                { ret.push([x2, _pos[1]-(x2-_pos[0])/Math.tan(angle)]); }
                    }
                    else {
                        var angletop = Math.atan((x1-_pos[0])/y);
                        var angle = Math.PI*_angle/180;
                        if (Math.abs(angle)<angletop)   { ret.push([_pos[0]-Math.tan(angle)*y, _pos[1]+y]); touch = true; } 
                        else                            { ret.push([x1, _pos[1]-(_pos[0]-x1)/Math.tan(-angle)]); }
                    }
                }
                
                var last = ret[ret.length-1];
                _pos    = [ last[0], last[1]];
                _angle  = -_angle;
            
            } while (!touch);
            
            return ret;
        },
        bubble: function($this,_val) {
            var settings = helpers.settings($this);
            var ret = {
                val     : _val,
                pos     : [0,0],
                $svg    : 0,
                size    : settings.bubble,
                move    : { step:[], cbk:0 },
                tmp     : 0,
                remove  : false
            };
            
            ret.moveto = function(_pos, _speed, _cbk) {
                if (_speed) {
                    var sp2 = _speed*_speed;
                    this.move.cbk   = _cbk;
                    this.move.step  = [];
                        
                    if ($.isArray(_pos[0])) {
                        var last=[];
                        for (var i=0; i<_pos.length; i++) {
                            if (i) {
                                var l2 = (last[0]-_pos[i][0])*(last[0]-_pos[i][0])+(last[1]-_pos[i][1])*(last[1]-_pos[i][1]);
                                var nb = Math.ceil(l2*fps/sp2);
                                for (var j=1; j<=nb; j++) {
                                   this.move.step.push([last[0]*(1-j/nb)+_pos[i][0]*j/nb, last[1]*(1-j/nb)+_pos[i][1]*j/nb]);
                                }
                            }
                            last = _pos[i];
                        }
                    }
                    else {
                        var l2 = (this.pos[0]-_pos[0])*(this.pos[0]-_pos[0])+(this.pos[1]-_pos[1])*(this.pos[1]-_pos[1]);
                        var nb = Math.ceil(l2*fps/sp2);
                        
                        for (var j=1; j<=nb; j++) {
                            this.move.step.push([this.pos[0]*(1-j/nb)+_pos[0]*j/nb, this.pos[1]*(1-j/nb)+_pos[1]*j/nb]);
                        }
                    }
                   
                    
                    settings.moves.elts.push(this);
                    if (settings.moves.timerid==0) { helpers.moves($this); }
                }
                else {
                    this.pos=[_pos[0],_pos[1]];
                    this.$svg.attr("transform","translate("+_pos[0]+","+_pos[1]+")");
                }
            };
            ret.inter = function(_from, _angle) {
                var ret=false, alpha = -Math.tan(Math.PI*_angle/180), N = _from[0]-alpha*_from[1]-this.pos[0];
                var A = 1+alpha*alpha, B = 2*alpha*N-2*this.pos[1], C = this.pos[1]*this.pos[1]+N*N-this.size[0]*this.size[0];
                if (B*B-4*A*C>=0) {
                    var y = -(B-Math.sqrt(B*B-4*A*C))/(2*A);
                    var x = (y-_from[1])*alpha+_from[0];
                    ret = [x,y];
                }
                return ret;

            };
            
            ret.$svg = $("#bubble", settings.svg.root()).clone().attr("id","").attr("class","bubble "+colors[_val])
                        .appendTo($("#area", settings.svg.root()));
            
            return ret;
        },
        moves:function($this) {
            var settings = helpers.settings($this), tmp=[];
            settings.moves.timerid = 0;
            for (var i in settings.moves.elts) {
                var elt = settings.moves.elts[i];
                elt.pos = elt.move.step.shift();
                elt.$svg.attr("transform","translate("+elt.pos[0]+","+elt.pos[1]+")");
                if (elt.move.step.length)   { tmp.push(elt); }
                else if (elt.move.cbk)      { elt.move.cbk.call(elt); }
            }
            settings.moves.elts = tmp;
            if (settings.moves.elts.length) {
                settings.moves.timerid = setTimeout(function() { helpers.moves($this);}, 1000/fps);
            }
        },
        ijtopos: function($this, _i, _j) {
            var settings = helpers.settings($this);
            return [settings.wall[0]+(_i+0.5)*settings.bubble[0] + (_j%2)*settings.bubble[0]/2,
                    settings.wall[1]+settings.bubble[0]/2+(_j+settings.level)*settings.bubble[1]];
        },
        display: function($this) {
            var settings = helpers.settings($this);
            
            $("#hydro",settings.svg.root()).attr("transform","translate(0,"+settings.level*settings.bubble[1]+")");
            if ((settings.count+1)%settings.change==0)  { $("#warning",settings.svg.root()).show(); }
            else                                        { $("#warning",settings.svg.root()).hide(); }
            
            for (var j=0; j<(10+1); j++) for (var i=0; i<8; i++) {
                var elt = settings.data[j][i];
                if (elt) { elt.moveto(helpers.ijtopos($this,i,j)); }
            }          
        },
        next: function($this) {
            var settings = helpers.settings($this);
 
            var ishere = [];
            for (var i in colors) { ishere.push(false); }
            for (var j=0; j<10; j++) for (var i=0; i<8; i++) {
                var elt = settings.data[j][i];
                if (elt) { ishere[elt.val] = true; }
            }
            
            var val;
            do { val = Math.floor(Math.random()*colors.length); } while (!ishere[val]);
            
            settings.next = helpers.bubble($this, val);
            settings.next.moveto([142,432]);
        },
        run: function($this) {
            var settings = helpers.settings($this);
            
            
            
            if (settings.count && (settings.count%settings.change==0)) {
                settings.level++;
                $("#hydro",settings.svg.root()).attr("transform","translate(0,"+settings.level*settings.bubble[1]+")");
                helpers.display($this);
            }
            
            settings.count++;
            
            var ok = true;
            for (var j=10; j>=10-settings.level; j--) for (var i=0; i<8; i++) {
                if (settings.data[j][i]) { ok =false; }
            }
            
            if (ok) {
                settings.next.moveto([settings.wheel[0],settings.wheel[1]],200);
                settings.current = settings.next;
                settings.next = 0;
                setTimeout(function(){ helpers.next($this); settings.interactive = true; }, 500);
            }
            else { helpers.failed($this,0); }
        },
        failed: function($this, count) {
            var settings = helpers.settings($this);
            for (var i=0; i<8; i++) {
                var cell=settings.data[10-count-settings.level][i];
                if (cell) { cell.$svg.attr("class","bubble"); }
            }
            if (count==10-settings.level)   {
                
                setTimeout(function(){
                    for (var j=0; j<(10+1); j++) for (var i=0; i<8; i++) {
                        var elt = settings.data[j][i];
                        if (elt) { elt.moveto([elt.pos[0],elt.pos[1]+480],600+j*40); }
                        
                        setTimeout(function(){ helpers.end($this)}, 2000);
                    }
                    
                    
                },200);
                
            }
            else                            { setTimeout(function(){helpers.failed($this, count+1);},100); }
        }
    };

    // The plugin
    $.fn.launch = function(method) {

        // public methods
        var methods = {
            init: function(options) {
                // The settings
                var settings = {
                    interactive     : false,
                    ratio           : 0,
                    action          : { first:0, last:0, angle: 0},
                    data            : [],
                    moves           : { elts:[], timerid:0 },
                    next            : 0,
                    score           : 0,
                    count           : 0,
                    angle           : 0
                };

                return this.each(function() {
                    var $this = $(this);
                    helpers.unbind($this);

                    var $settings = $.extend({}, defaults, options, settings);
                    var checkContext = helpers.checkContext($settings);
                    if (checkContext.length) {
                        alert("CONTEXT ERROR:\n"+checkContext);
                    }
                    else {
                        $this.removeClass();
                        if ($settings["class"]) { $this.addClass($settings["class"]); }
                        helpers.settings($this.addClass(defaults.name), $settings);
                        helpers.loader.css($this);
                    }
                });
            },
            next: function() {
                var $this = $(this) , settings = helpers.settings($this);
                helpers.run($this);
            },
            quit: function() {
                var $this = $(this) , settings = helpers.settings($this);
                settings.context.onquit($this,{'status':'abort'});
            }
        };

        if (methods[method])    { return methods[method].apply(this, Array.prototype.slice.call(arguments, 1)); } 
        else if (typeof method === 'object' || !method) { return methods.init.apply(this, arguments); }
        else { $.error( 'Method "' +  method + '" does not exist in launch plugin!'); }
    };
})(jQuery);
