(function($) {
    // Activity default options
    var defaults = {
        name        : "robot",                                  // The activity name
        label       : "Robot",                                  // The activity label
        template    : "template.html",                          // Activity's html template
        css         : "style.css",                              // Activity's css style sheet
        lang        : "en-US",                                  // Current localization
        score       : 1,                                        // The score (from 1 to 5)
        padding     : 3,                                        // Padding top
        margin      : 0.5,                                      // Margin
        worst       : [],                                       // The worst scenario (for multi-robots)
        max         : 200,                                      // Maximum operations allowed
        maxbt       : 20,                                       // Maximum bt allowed
		speed		: 1,
        debug       : true                                     // Debug mode
    };

    var permut = [
        [[0]],
        [[0,1]],
        [[0,1,2],[0,2,1]],
        [[0,1,2,3],[0,1,3,2],[0,2,1,3],[0,2,3,1],[0,3,1,2],[0,3,2,1]]
    ];

    // to complete
    var worst = [
        [[0]],
        [[0,1],[0,0,1],[0,0,0,1],[0,0,0,0,1],[0,0,0,0,0,1],[0,0,0,0,0,0,1],[0,0,1,0,0,0,1]],
        [[0,1,2],[0,0,1,2],[0,0,0,1,2],[0,0,0,0,1,2],[0,0,0,0,0,1,2],[0,0,0,0,0,0,1,2]],
        [[0,1,2,3],[0,0,1,2,3],[0,0,0,1,2,3],[0,0,0,0,0,0,1,2,3]]
    ];

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
            $this.unbind("mouseup mousedown mousemove mouseleave touchstart touchmove touchend touchleave");
        },
        // Quit the activity by calling the context callback
        end: function($this, _args) {
            var settings = helpers.settings($this);
            helpers.unbind($this);
            settings.context.onquit($this,_args);
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
                $this.load( templatepath, function(response, status, xhr) { helpers.loader.build($this); });
            },
            build: function($this) {
                var settings = helpers.settings($this);
                if (settings.context.onload) { settings.context.onload($this); }

                // compute scale and offset if not given
                var xmin=0, xmax=0, ymin=0, ymax=0;
                for (var j=0; j<settings.board.length; j++) for (var i=0; i<settings.board[j].length; i++) if (settings.board[j][i]) {
                    if (i+j<xmin) { xmin = i+j; }
                    if (i+j>xmax) { xmax = i+j; }
                    if (i-j<ymin) { ymin = i-j; }
                    if (i-j>ymax) { ymax = i-j; }
                }
                ymin+=settings.board.length-1; ymax+=settings.board.length-1;

                // +8 : 4 for the tile thickness, 4 for the robot head in the top of the board
                var vx = ((xmax-xmin)*2)+8+settings.padding, vy = (ymax-ymin+2)*4, vv = Math.max(vx,vy);
                settings.scale=(18/(vv+settings.margin*2));
                $this.find("#rttiles").css("font-size", settings.scale+"em");

                settings.offset=[-2*ymin+(vv-vy)/4+settings.margin/2,
                                 1+settings.padding/2-2*xmin+(vv-vx)/6+settings.margin/2];


                // Update the gui
                for (var i=0; i<4; i++) {
                    if (i<settings.robots.length) {
                        for (var j=0; j<3; j++) {
                            if ($.isArray(settings.robots[i].code[j])) {
                                $this.find("#rttabs #t"+(i+1)+" .f"+j+" div.z").each(function(_index) {
                                    $(this).toggle(_index<settings.robots[i].code[j].length);
                                    if (_index<settings.robots[i].code[j].length) {
                                        $(this).append("<div class='a'><img src='res/img/action/"+
                                            settings.robots[i].code[j][_index]+".svg' alt='"+
                                            settings.robots[i].code[j][_index]+"' style='position:relative;'/></div>");
                                    }
                                });
                                $this.find("#rttabs #t"+(i+1)+" .f"+j+" div.z").removeClass("dd");
                            }
                            else {
                                $this.find("#rttabs #t"+(i+1)+" .f"+j+" div.z").each(function(_index) {
                                    $(this).toggle(_index<settings.robots[i].code[j]);
                                });
                            }
                        }
                    }
                    else {
                        $this.find("#rttab #r"+(i+1)).hide();
                    }
                }

                // Build the board
                settings.tiles.size=[settings.board[0].length,settings.board.length];

                for (var j=0; j<settings.board.length; j++) for (var i=0; i<settings.board[j].length; i++) if (settings.board[j][i]) {
                    // TURN OFF THE LIGHT
                    if (settings.board[j][i]<500 && (settings.board[j][i]%100) == 52) { settings.board[j][i]=51; }

                    // STORE THE NUMBER IF ANY
                    if (settings.board[j][i]>=650 && settings.board[j][i]<660) { settings.numberinit = settings.board[j][i]-650; }

                    // NOT REALLY USEFUL
                    var tile = {
                        top     :   j,
                        left    :   i,
                        value   :   settings.board[j][i],
                        id      :   (i+j*settings.tiles.size[0]),
                        html    :   function() {
                            var ret = "<div style='";
                            ret+="left:"+(settings.offset[0]+((this.left*2)+(settings.tiles.size[1]-this.top-1)*2))+"em;";
                            ret+="top:"+(settings.offset[1]+this.left+this.top)+"em;";
                            ret+="z-index:"+(10+this.left+this.top+(this.value%100>=50?1:0))+";' ";
                            ret+="id='"+(this.left+this.top*settings.tiles.size[0])+"' ";
                            ret+="class='tile t"+(this.value<10?"00":(this.value<100?"0":""))+this.value+" s"+(this.value%100>=50?"1":"0")+"'";
                            ret+="><img src='res/img/tileset/iso/set1/";
                            ret+=(this.value<10?"00":(this.value<100?"0":""))+this.value;
                            ret+=".svg'/></div>";
                            return ret;
                        }
                    };

                    $this.find("#rttiles").append(tile.html());
                    settings.tiles.data.push(settings.board[j][i]);
                }
                else { settings.tiles.data.push(0); }

                // Initialize the robots
                for (var i in settings.robots) {
                    var html="<div class='engine' id='robot"+i+"'><div id='img'><img src=''/></div><div id='invert'><img src='res/img/tileset/iso/robot/statinvert.svg'/></div></div>";
                    $this.find("#rttiles").append(html);
                    helpers.update($this, i, settings.robots[i].origin);

                    // Initialize the action cards
                    for (var j in settings.robots[i].actions) {
                        var $elt = $($this.find("#rttabs #t"+(parseInt(i)+1)+" .rtcode .z").get(parseInt(j)));
                        var $html=$("<div class='a'><img src='res/img/action/"+settings.robots[i].actions[j]+".svg' alt='"+settings.robots[i].actions[j]+"'/></div>");
                        $elt.html($html);
                        $html.draggable({ containment:$this.find("#t"+(parseInt(i)+1)), revert:true, stack:".a"});
                    }

                    // Check the up and down button
                    
                    settings.sourceid[i]    = 0;
                    settings.sourcemax[i]   = 0;
                    if (settings.robots[i].actions) {
                        $this.find(".source .slider>div").toggle((settings.robots[i].actions.length>15));
                        settings.sourcemax[i]=Math.floor((settings.robots[i].actions.length-1)/5)-2;
                    }
                }

                // BUILD WORST
                // Compute all permutation
                if (settings.robots.length>1 && !settings.worst.length) {
                    var p = permut[settings.robots.length-1];
                    var pp = [];
                    for (var i=0; i<settings.robots.length; i++) {
                        for (var j in p) {
                            var tmp = [];
                            for (var k in p[j]) { tmp.push((p[j][k]+i)%settings.robots.length); }
                            pp.push(tmp);
                        }
                    }

                    var w = worst[settings.robots.length-1];
                    for (var i in pp) for (var j in w) {
                        var tmp= [];
                        for (var k in w[j]) { tmp.push(pp[i][w[j][k]]); }
                        settings.worst.push(tmp);
                    }
                }

                helpers.updatesource($this);
				helpers.speed($this,false);

                $this.find(".dd").droppable({accept:".a",
                    drop:function(event, ui) {
                        var vEvent = (event && event.originalEvent && event.originalEvent.touches && event.originalEvent.touches.length)?
                                    event.originalEvent.touches[0]:event;
                        $this.find("#rttouch>div")
							.addClass("g_arunning").parent()
							.css("left",event.clientX-$this.offset().left)
                            .css("top",event.clientY-$this.offset().top).show();
                        setTimeout(function(){$this.find("#rttouch>div").removeClass("g_arunning").parent().hide(); },800);


                        if ($(this).children().size()) { $(this).children().detach().appendTo(ui.draggable.parent()); }
                        $(ui.draggable).detach().css("top",0).css("left",0).css("width","inherit").css("height","inherit");
                        $(this).append(ui.draggable);
                } });
                
                // HANDLE THE TIPS
                if (settings.tips) {
                    $this.find("#g_tbutton>div").html(settings.tips.length);
                    $this.find("#g_tip .g_tnum1").addClass("s");
                }
				
                // LOCALE
                if (settings.locale) { $.each(settings.locale, function(id,value) {
                    if (id=="legend") { for (var i in value) { $this.find("#"+i).html(value[i]); }}
                    else { $this.find("#"+id).html(jtools.format(value)); }
                }); }
                
                
                if (!$this.find("#g_splash").is(":visible")) { setTimeout(function() { $this[settings.name]('next'); }, 500); }
            }
        },
        // GET THE DELAY ACCORDING TO THE SPEED VALUE
        delay: function($this) { var settings = helpers.settings($this); return Math.floor(1000/Math.pow(2,settings.speed)); },
        // GET AN ACTION FROM THE METHODS
        get: function($this, _robot, _fct, _id) {
            var settings = helpers.settings($this);
            var ret = 0;
            settings.lastelt = $($this.find("#rttabs #t"+(_robot+1)+" .f"+_fct+" .z").get(_id));
            if (settings.lastelt.children().length) { ret = settings.lastelt.find("img").attr("alt"); }
            return ret;
        },
        // GET THE WORST SCENARIO TODO
        worst: function($this) {
            var settings = helpers.settings($this);
            return [[0]];
        },
        // UPDATE THE SOURCE CODE DISPLAY
        updatesource: function($this) {
            var settings    = helpers.settings($this);
            $this.find(".rtcode tr").each(function(_index) {
                var robotid = Math.floor(_index/9);
                var rowid = _index%9;
                $(this).toggle(rowid>=settings.sourceid[robotid]&&rowid<settings.sourceid[robotid]+3);
            });
        },
        // UPDATE ROBOT POSITION
        update : function($this, _id, _pos, _anim) {
            var settings    = helpers.settings($this);
            if (!settings.synchro) {
                var $robot      = $this.find("#robot"+_id);

                $this.find("#robot"+_id+" #invert").toggle(typeof(settings.robots[_id].invert)!='undefined' &&
                                                           settings.robots[_id].invert);

                if (_pos) {
                    var zindex      = 10+parseInt(_pos[0])+parseInt(_pos[1]);

                    $this.find("#robot"+_id+" #img img").attr("src","res/img/tileset/iso/robot/robot"+_id+(_pos[2]+1)+".svg");
                    if (!_anim || zindex>$robot.css("z-index")) { $robot.css("z-index", zindex); }

                    if (_anim) {
                        $robot.animate({
                            "left":(settings.offset[0]+((_pos[0]*2)+(settings.tiles.size[1]-_pos[1]-1)*2))+"em",
                            "top":(settings.offset[1]+(1.0*_pos[0]+1.0*_pos[1]))+"em"},helpers.delay($this),function(){});
                    }
                    else {
                        $robot.css("left", (settings.offset[0]+((_pos[0]*2)+(settings.tiles.size[1]-_pos[1]-1)*2))+"em")
                            .css("top",  (settings.offset[1]+(1.0*_pos[0]+1.0*_pos[1]))+"em");
                    }
                }
                else {
                    $robot.animate({"top":Math.floor(20/settings.scale)+"em"},helpers.delay($this),function(){});
                }
            }
        },
        // UPDATE THE ZINDEX OF EVERY ROBOTS
        zindex: function($this) {
            var settings    = helpers.settings($this);
            if (!settings.synchro) for (var i in settings.robots) {
                var zindex = 10+parseInt(settings.robots[i].pos[0])+parseInt(settings.robots[i].pos[1]);
                var $robot = $this.find("#robot"+i);
                if ($robot && $robot.css("z-index")!=zindex) { $robot.css("z-index", zindex); }
            }
        },
        num: function($this, _val) {
            var settings    = helpers.settings($this);
            settings.tiles.number = _val;
            if (!settings.synchro) for (var i=0; i<10; i++) {
                $this.find(".t6"+(i+50)+" img").attr("src","res/img/tileset/iso/set1/6"+(_val+50)+".svg");
            }
        },
        // THE ACTIONS
        actions : {
            f01 : {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    var value = _invert?(settings.robots[_id].pos[2]+2)%4:settings.robots[_id].pos[2];
                    switch(value) {
                        case 0: settings.robots[_id].pos[0]++; break;
                        case 1: settings.robots[_id].pos[1]++; break;
                        case 2: settings.robots[_id].pos[0]--; break;
                        case 3: settings.robots[_id].pos[1]--; break;
                    }
                }
            },
            b01 : {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    var value = _invert?(settings.robots[_id].pos[2]+2)%4:settings.robots[_id].pos[2];
                    switch(value) {
                        case 0: settings.robots[_id].pos[0]--; break;
                        case 1: settings.robots[_id].pos[1]--; break;
                        case 2: settings.robots[_id].pos[0]++; break;
                        case 3: settings.robots[_id].pos[1]++; break;
                    }
                }
            },
            turnright: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    settings.robots[_id].pos[2]=(settings.robots[_id].pos[2]+(_invert?3:1))%4;
                }
            },
            turnleft: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    settings.robots[_id].pos[2]=(settings.robots[_id].pos[2]+(_invert?1:3))%4;
                }
            },
            invert: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    settings.robots[_id].invert=!settings.robots[_id].invert;
                }
            },
            nothing: { execute     : function($this, _id, _invert) { } },
            num: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    var val = helpers.tiles.get($this, settings.robots[_id].pos)%100;
                    if (val>=10&&val<=19) { helpers.num($this, val-10); }
                }
            },
            num0: { execute: function($this, _id, _invert) { helpers.num($this, 0); }},
            num1: { execute: function($this, _id, _invert) { helpers.num($this, 1); }},
            num2: { execute: function($this, _id, _invert) { helpers.num($this, 2); }},
            num3: { execute: function($this, _id, _invert) { helpers.num($this, 3); }},
            num4: { execute: function($this, _id, _invert) { helpers.num($this, 4); }},
            num5: { execute: function($this, _id, _invert) { helpers.num($this, 5); }},
            num6: { execute: function($this, _id, _invert) { helpers.num($this, 6); }},
            num7: { execute: function($this, _id, _invert) { helpers.num($this, 7); }},
            num8: { execute: function($this, _id, _invert) { helpers.num($this, 8); }},
            num9: { execute: function($this, _id, _invert) { helpers.num($this, 9); }},
            numminus: {
                execute: function($this, _id, _invert) {
                    var settings    = helpers.settings($this);
                    if (settings.tiles.number>0) { helpers.num($this, settings.tiles.number-1); }
                }
            },
            numplus: {
                execute: function($this, _id, _invert) {
                    var settings    = helpers.settings($this);
                    if (settings.tiles.number<9) { helpers.num($this, settings.tiles.number+1); }
                }
            },
            blue: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[0] = true;
                    if (!settings.synchro) {
                        $this.find(".t051 img").attr("src","res/img/tileset/iso/set1/052.svg");
                        $this.find(".t052 img").attr("src","res/img/tileset/iso/set1/052.svg");
                    }
                }
            },
            red: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[1] = true;
                    if (!settings.synchro) {
                        $this.find(".t151 img").attr("src","res/img/tileset/iso/set1/152.svg");
                        $this.find(".t152 img").attr("src","res/img/tileset/iso/set1/152.svg");
                    }
                }
            },
            green: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[2] = true;
                    if (!settings.synchro) {
                        $this.find(".t251 img").attr("src","res/img/tileset/iso/set1/252.svg");
                        $this.find(".t252 img").attr("src","res/img/tileset/iso/set1/252.svg");
                    }
                }
            },
            purple: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[3] = true;
                    if (!settings.synchro) {
                        $this.find(".t351 img").attr("src","res/img/tileset/iso/set1/352.svg");
                        $this.find(".t352 img").attr("src","res/img/tileset/iso/set1/352.svg");
                    }
                }
            },
            notblue: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[0] = false;
                    if (!settings.synchro) {
                        $this.find(".t051 img").attr("src","res/img/tileset/iso/set1/051.svg");
                        $this.find(".t052 img").attr("src","res/img/tileset/iso/set1/051.svg");
                    }
                }
            },
            notred: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[1] = false;
                    if (!settings.synchro) {
                        $this.find(".t151 img").attr("src","res/img/tileset/iso/set1/151.svg");
                        $this.find(".t152 img").attr("src","res/img/tileset/iso/set1/151.svg");
                    }
                }
            },
            notgreen: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[2] = false;
                    if (!settings.synchro) {
                        $this.find(".t251 img").attr("src","res/img/tileset/iso/set1/251.svg");
                        $this.find(".t252 img").attr("src","res/img/tileset/iso/set1/251.svg");
                    }
                }
            },
            notpurple: {
                execute     : function($this, _id, _invert) {
                    var settings = helpers.settings($this);
                    helpers.settings($this).tiles.light[3] = false;
                    if (!settings.synchro) {
                        $this.find(".t351 img").attr("src","res/img/tileset/iso/set1/351.svg");
                        $this.find(".t352 img").attr("src","res/img/tileset/iso/set1/351.svg");
                    }
                }
            },
            ifblue: {
                test        : function($this, _id) {
                    return (Math.floor(helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)/100)==0);
                }
            },
            ifred: {
                test        : function($this, _id) {
                    return (Math.floor(helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)/100)==1);
                }
            },
            ifgreen: {
                test        : function($this, _id) {
                    return (Math.floor(helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)/100)==2);
                }
            },
            ifpurple: {
                test        : function($this, _id) {
                    return (Math.floor(helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)/100)==3);
                }
            },
            ifblueend: {
                test        : function($this, _id) {
                    return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)==2);
                }
            },
            ifredend: {
                test        : function($this, _id) {
                    return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)==102);
                }
            },
            ifgreenend: {
                test        : function($this, _id) {
                    return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)==202);
                }
            },
            ifpurpleend: {
                test        : function($this, _id) {
                    return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)==302);
                }
            },
            iflblue:        { test: function($this, _id) { return helpers.settings($this).tiles.light[0]; } },
            iflred:         { test: function($this, _id) { return helpers.settings($this).tiles.light[1]; } },
            iflgreen:       { test: function($this, _id) { return helpers.settings($this).tiles.light[2]; } },
            iflpurple:      { test: function($this, _id) { return helpers.settings($this).tiles.light[3]; } },
            ifnotblue:      { test: function($this, _id) { return !helpers.actions.ifblue.test($this,_id); } },
            ifnotred:       { test: function($this, _id) { return !helpers.actions.ifred.test($this,_id); } },
            ifnotgreen:     { test: function($this, _id) { return !helpers.actions.ifgreen.test($this,_id); } },
            ifnotpurple:    { test: function($this, _id) { return !helpers.actions.ifpurple.test($this,_id); } },
            ifnotblueend:   { test: function($this, _id) { return !helpers.actions.ifblueend.test($this,_id); } },
            ifnotredend:    { test: function($this, _id) { return !helpers.actions.ifredend.test($this,_id); } },
            ifnotgreenend:  { test: function($this, _id) { return !helpers.actions.ifgreenend.test($this,_id); } },
            ifnotpurpleend: { test: function($this, _id) { return !helpers.actions.ifpurpleend.test($this,_id); } },
            iflnotblue:     { test: function($this, _id) { return !helpers.actions.iflblue.test($this,_id); } },
            iflnotred:      { test: function($this, _id) { return !helpers.actions.iflred.test($this,_id); } },
            iflnotgreen:    { test: function($this, _id) { return !helpers.actions.iflgreen.test($this,_id); } },
            iflnotpurple:   { test: function($this, _id) { return !helpers.actions.iflpurple.test($this,_id); } },
            ifeq0:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==10);
            }},
            ifeq1:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==11);
            }},
            ifeq2:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==12);
            }},
            ifeq3:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==13);
            }},
            ifeq4:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==14);
            }},
            ifeq5:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==15);
            }},
            ifeq6:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==16);
            }},
            ifeq7:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==17);
            }},
            ifeq8:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==18);
            }},
            ifeq9:       { test: function($this, _id) {
                return (helpers.tiles.get($this, helpers.settings($this).robots[_id].pos)%100==19);
            }},
            ifnoteq0:   { test: function($this, _id) { return !helpers.actions.ifeq0.test($this,_id); } },
            ifnoteq1:   { test: function($this, _id) { return !helpers.actions.ifeq1.test($this,_id); } },
            ifnoteq2:   { test: function($this, _id) { return !helpers.actions.ifeq2.test($this,_id); } },
            ifnoteq3:   { test: function($this, _id) { return !helpers.actions.ifeq3.test($this,_id); } },
            ifnoteq4:   { test: function($this, _id) { return !helpers.actions.ifeq4.test($this,_id); } },
            ifnoteq5:   { test: function($this, _id) { return !helpers.actions.ifeq5.test($this,_id); } },
            ifnoteq6:   { test: function($this, _id) { return !helpers.actions.ifeq6.test($this,_id); } },
            ifnoteq7:   { test: function($this, _id) { return !helpers.actions.ifeq7.test($this,_id); } },
            ifnoteq8:   { test: function($this, _id) { return !helpers.actions.ifeq8.test($this,_id); } },
            ifnoteq9:   { test: function($this, _id) { return !helpers.actions.ifeq9.test($this,_id); } },
            ifinvert:   { test: function($this, _id) { return helpers.settings($this).robots[_id].invert; } },
            ifnotinvert:{ test: function($this, _id) { return !helpers.settings($this).robots[_id].invert; } },
            ifnum0:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==0); } },
            ifnum1:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==1); } },
            ifnum2:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==2); } },
            ifnum3:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==3); } },
            ifnum4:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==4); } },
            ifnum5:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==5); } },
            ifnum6:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==6); } },
            ifnum7:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==7); } },
            ifnum8:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==8); } },
            ifnum9:     { test: function($this, _id) { return (helpers.settings($this).tiles.number==9); } },
            ifnotnum0:  { test: function($this, _id) { return !helpers.actions.ifnum0.test($this,_id); } },
            ifnotnum1:  { test: function($this, _id) { return !helpers.actions.ifnum1.test($this,_id); } },
            ifnotnum2:  { test: function($this, _id) { return !helpers.actions.ifnum2.test($this,_id); } },
            ifnotnum3:  { test: function($this, _id) { return !helpers.actions.ifnum3.test($this,_id); } },
            ifnotnum4:  { test: function($this, _id) { return !helpers.actions.ifnum4.test($this,_id); } },
            ifnotnum5:  { test: function($this, _id) { return !helpers.actions.ifnum5.test($this,_id); } },
            ifnotnum6:  { test: function($this, _id) { return !helpers.actions.ifnum6.test($this,_id); } },
            ifnotnum7:  { test: function($this, _id) { return !helpers.actions.ifnum7.test($this,_id); } },
            ifnotnum8:  { test: function($this, _id) { return !helpers.actions.ifnum8.test($this,_id); } },
            ifnotnum9:  { test: function($this, _id) { return !helpers.actions.ifnum9.test($this,_id); } },
            x2:         { loop : function($this, _id, _val) { return _val?_val-1:2; }},
            x3:         { loop : function($this, _id, _val) { return _val?_val-1:3; }},
            x4:         { loop : function($this, _id, _val) { return _val?_val-1:4; }},
            x5:         { loop : function($this, _id, _val) { return _val?_val-1:5; }},
            xnum:       { loop : function($this, _id, _val) { return _val?_val-1:helpers.settings($this).tiles.number; }},
            whileblue:  { loop : function($this, _id, _val) { return (helpers.actions.ifblue.test($this,_id)?99:0); } },
            whilered:   { loop : function($this, _id, _val) { return (helpers.actions.ifred.test($this,_id)?99:0); } },
            whilegreen: { loop : function($this, _id, _val) { return (helpers.actions.ifgreen.test($this,_id)?99:0); } },
            whilepurple:{ loop : function($this, _id, _val) { return (helpers.actions.ifpurple.test($this,_id)?99:0); } },
            whilenotblue:  { loop : function($this, _id, _val) { return (helpers.actions.ifnotblue.test($this,_id)?99:0); } },
            whilenotred:   { loop : function($this, _id, _val) { return (helpers.actions.ifnotred.test($this,_id)?99:0); } },
            whilenotgreen: { loop : function($this, _id, _val) { return (helpers.actions.ifnotgreen.test($this,_id)?99:0); } },
            whilenotpurple:{ loop : function($this, _id, _val) { return (helpers.actions.ifnotpurple.test($this,_id)?99:0); } },
            whilenotblueend:  { loop : function($this, _id, _val) { return (helpers.actions.ifnotblueend.test($this,_id)?99:0); } },
            whilenotredend:   { loop : function($this, _id, _val) { return (helpers.actions.ifnotredend.test($this,_id)?99:0); } },
            whilenotgreenend: { loop : function($this, _id, _val) { return (helpers.actions.ifnotgreenend.test($this,_id)?99:0); } },
            whilenotpurpleend:{ loop : function($this, _id, _val) { return (helpers.actions.ifnotpurpleend.test($this,_id)?99:0); } },
            whilelblue:  { loop : function($this, _id, _val) { return (helpers.actions.iflblue.test($this,_id)?99:0); } },
            whilelred:   { loop : function($this, _id, _val) { return (helpers.actions.iflred.test($this,_id)?99:0); } },
            whilelgreen: { loop : function($this, _id, _val) { return (helpers.actions.iflgreen.test($this,_id)?99:0); } },
            whilelpurple:{ loop : function($this, _id, _val) { return (helpers.actions.iflpurple.test($this,_id)?99:0); } },
            whilelnotblue:  { loop : function($this, _id, _val) { return (helpers.actions.iflnotblue.test($this,_id)?99:0); } },
            whilelnotred:   { loop : function($this, _id, _val) { return (helpers.actions.iflnotred.test($this,_id)?99:0); } },
            whilelnotgreen: { loop : function($this, _id, _val) { return (helpers.actions.iflnotgreen.test($this,_id)?99:0); } },
            whilelnotpurple:{ loop : function($this, _id, _val) { return (helpers.actions.iflnotpurple.test($this,_id)?99:0); } },
            fct1: { },
            fct2: { }
        },
        // HANDLE THE TILES AND THEIR BEHAVIOUR
        tiles : {
            get: function($this, _pos) {
                var settings = helpers.settings($this);
                var ret = 0;
                if (_pos[0]>=0 && _pos[0]<settings.tiles.size[0] && _pos[1]>=0 && _pos[1]<settings.tiles.size[1]) {
                    ret = settings.tiles.data[_pos[0]+_pos[1]*settings.tiles.size[0]];
                }
                return ret;
            },
            execute: function($this, _id) {
                var settings = helpers.settings($this);
                var ret = false;
                var alreadydone = ((settings.robots[_id].pos[0]==settings.robots[_id].sav[0]) &&
                                   (settings.robots[_id].pos[1]==settings.robots[_id].sav[1]));
                var tile = parseInt(helpers.tiles.get($this, settings.robots[_id].pos));
                if (!alreadydone && tile) {
                    settings.robots[_id].sav[0]=settings.robots[_id].pos[0];
                    settings.robots[_id].sav[1]=settings.robots[_id].pos[1];
                    if (helpers.tiles["f"+(tile%100)]) {
                        ret = helpers.tiles["f"+(tile%100)]($this, settings.robots[_id], tile);
                    }
                }
                return ret;
            },
            quit: function($this, _id) {
                var settings = helpers.settings($this);
                var tile = parseInt(helpers.tiles.get($this, settings.robots[_id].sav));
                if (tile) {
                    if (helpers.tiles["q"+(tile%100)]) {
                        ret = helpers.tiles["q"+(tile%100)]($this, settings.robots[_id], tile);
                    }
                }
            },
            f3: function($this, _robots, _tile) { _robots.pos[2]=(_robots.pos[2]+3)%4; return true; },
            f4: function($this, _robots, _tile) { _robots.pos[2]=(_robots.pos[2]+1)%4; return true; },
            f5: function($this, _robots, _tile) { _robots.pos[1]--; return true; },
            f6: function($this, _robots, _tile) { _robots.pos[0]++; return true; },
            f7: function($this, _robots, _tile) { _robots.pos[1]++; return true; },
            f8: function($this, _robots, _tile) { _robots.pos[0]--; return true; },
            f20:function($this, _robots, _tile) {
                var c = Math.floor(_tile/100);
                var ret = helpers.settings($this).tiles.tile9[c];
                if (!helpers.settings($this).synchro && !ret) {
                    $this.find(".t"+c+"09 img").attr("src","res/img/tileset/iso/set1/"+c+"01.svg");
                    $this.find(".t"+c+"20 img").attr("src","res/img/tileset/iso/set1/"+c+"21.svg");
                }
                helpers.settings($this).tiles.tile9[c]=true;
                return false;
            },
            f23:function($this, _robots, _tile) { return helpers.tiles.f20($this, _robots, _tile); },
            f22:function($this, _robots, _tile) { _robots.invert = !_robots.invert; return true; },
            q23:function($this, _robots, _tile) { 
                var c = Math.floor(_tile/100);
                if (!helpers.settings($this).synchro) {
                    $this.find(".t"+c+"09 img").attr("src","res/img/tileset/iso/set1/"+c+"09.svg");
                }
                helpers.settings($this).tiles.tile9[c]=false;
            }
        },
        restore: function($this) {
            var settings = helpers.settings($this);
            helpers.execute.init($this);
            for (var i in settings.robots) helpers.update($this, i, settings.robots[i].pos, false);
            for (var c=0; c<4; c++) {
                $this.find(".t"+c+"09 img").attr("src","res/img/tileset/iso/set1/"+c+"09.svg");
                $this.find(".t"+c+"20 img").attr("src","res/img/tileset/iso/set1/"+c+"20.svg");
            }
            for (var c=50; c<60; c++) {
                $this.find(".t6"+c+" img").attr("src","res/img/tileset/iso/set1/6"+c+".svg");
            }
            $this.find(".t051 img").attr("src","res/img/tileset/iso/set1/051.svg");
            $this.find(".t151 img").attr("src","res/img/tileset/iso/set1/151.svg");
            $this.find(".t251 img").attr("src","res/img/tileset/iso/set1/251.svg");
            $this.find(".t351 img").attr("src","res/img/tileset/iso/set1/351.svg");
            $this.find("#rtcache").hide();
            $this.find(".target").hide();
            $this.find("#play img").attr("src","res/img/control/play.svg");
        },
        success: function($this, _count) {
            var settings = helpers.settings($this);
            var ret = (_count<settings.max);
            for (var i in settings.robots)
                if (parseInt(helpers.tiles.get($this, settings.robots[i].pos))!=i*100+2) { ret = false; }
            return ret;
        },
        endanimation: function($this, _count) {
            var settings = helpers.settings($this);
            $this.find(".target").hide();
            if (!settings.stop && helpers.success($this, _count)) {
                settings.score = 5-settings.wrong;
                if (settings.score<2) { settings.score = 2; }
                $this.find("#rtgoal").css("left","110%").show().animate({left:"50%"},500);
                setTimeout(function() {
                    helpers.end($this,{'status':'success','score':settings.score});
                    $this.find("#rtgoal").animate({left:"110%"},1000);
                }, 1000);
            }
            else {
                helpers.restore($this);
            }
        },
        endtest: function($this, _count) {
            var settings = helpers.settings($this);

            // TAKE CARE: WE TEST THE WORST BUT THE AVERAGE IS SHOWN IF THE WORST IS GOOD
            if (helpers.success($this, _count)) {
                if (++settings.testid<settings.worst.length) {
                    // CAN ANOTHER WORST SCENARIO BE TESTED
                    helpers.execute.launch($this, settings.worst[settings.testid], helpers.endtest, true);
                }
                else {
                    // ALL WORST SCENARIO ARE GOOD SO SHOW THE AVERAGE ONE
                    if (!settings.average) {
                        settings.average = [];
                        for (var i=0; i<settings.robots.length; i++) { settings.average.push(i); }
                    }
                    helpers.execute.launch($this, settings.average, helpers.endanimation, false);
                }
            }
            else { helpers.execute.launch($this, settings.worst[settings.testid], helpers.endanimation, false); }
        },
        // HANDLE THE EXECUTION OF THE PROGRAM
        execute: {
            // LAUNCH THE CURRENT PROGRAM
            launch: function($this, _robotsorder, _fct, _synchro) {
                helpers.settings($this).synchro = _synchro;
                helpers.execute.init($this);
                helpers.execute.run($this, _robotsorder, 0, _fct);
            },
            run: function($this, _robotsorder, _count, _fct) {
                var settings = helpers.settings($this);
                helpers.zindex($this);
                $this.find("#rtfx>div").hide();
                // ARE THE ROBOTS STILL IN GAME
                helpers.execute.active($this);

                // EXECUTE THE NEXT ORDER
                var stillarobot;
                var perform = false;
                do {
                    var robotid = _robotsorder[_count%_robotsorder.length];
                    if (settings.robots[robotid].active) {
                        perform = helpers.execute.next($this, robotid);
                        if (!perform) { settings.robots[robotid].active = false; }
                    }
                    stillarobot = false;
                    for (var i in settings.robots) { stillarobot = stillarobot | settings.robots[i].active; }
                    _count++;
                } while (_count<settings.max && stillarobot && !perform);


                if (settings.lastcount>=0) {
                    var lastrobotid = _robotsorder[settings.lastcount%_robotsorder.length];
                    if (settings.robots[robotid].sav[0]!=settings.robots[robotid].pos[0] ||
                        settings.robots[robotid].sav[1]!=settings.robots[robotid].pos[1])
                        { helpers.tiles.quit($this, lastrobotid); }
                }
                settings.lastcount = _count;

                if (stillarobot && _count<settings.max && !settings.stop) {
                    if (settings.synchro) {
                        helpers.execute.tiles($this, _robotsorder,_count,_fct);
                    }
                    else {
                        // TODO
                        var rid = _robotsorder[(_count-1)%_robotsorder.length];
                        var $t = $this.find("#target"+(rid+1));
                        if ($this.find("#t"+(rid+1)).is(":visible")) {
                            var o = Math.floor(($this.find("#target"+(rid+1)).width() - settings.lastelt.height())/2);
                            $t.css("top",(settings.lastelt.offset().top+settings.targetoffset[0]-o)+"px")
                              .css("left",(settings.lastelt.offset().left+settings.targetoffset[1]-o)+"px").show();
                        }
                        else { $t.hide(); }


                        $this.find("#robotfx").show();
                        setTimeout( function() {
                                helpers.execute.tiles($this, _robotsorder,_count,_fct);
                            },
                            helpers.delay($this)); }
                }
                else { setTimeout( function(){_fct($this, _count);},
                                   (settings.synchro)?0:Math.floor(2*helpers.delay($this)));  }
            },
            // INITIALISATION OF THE PROGRAM
            init: function($this) {
                var settings = helpers.settings($this);
                
                // Target offset
                settings.targetoffset=[-$this.find("#t1").offset().top,-$this.find("#t1").offset().left];
                
                // INITIALIZE THE ROBOTS
                for (var i in settings.robots) {
                    settings.robots[i].pos=[settings.robots[i].origin[0], settings.robots[i].origin[1], settings.robots[i].origin[2]];
                    settings.robots[i].fct      =0;             // 0 for main, 1 f0, 2 f1
                    settings.robots[i].cp       =[0,0,0];       // main id, f0 id, f1 id
                    settings.robots[i].bt       =[];            // Stack of loops and f0/f1 calls
                    settings.robots[i].active   = true;         // not in a hole and with actions
                    settings.robots[i].sav      =[settings.robots[i].origin[0], settings.robots[i].origin[1]]; // last position
                    settings.robots[i].invert   =false;         // invert the commands
                }
                // INITIALIZE THE TILES
                settings.tiles.tile9=[false,false,false,false];
                settings.tiles.light=[false,false,false,false];
                settings.tiles.number=settings.numberinit;
                settings.lastcount = -1;
                settings.lastelt = 0;
            },
            // NEXT OPERATION
            next: function($this, id) {
                var settings = helpers.settings($this);
                var isaction    = false;
                var execute     = false;
                var testval     = true;
                if (settings.robots[id].active) {
                    do {
                        var action = helpers.get($this, id, settings.robots[id].fct, settings.robots[id].cp[settings.robots[id].fct]);
                        if (action) {
                            isaction=true;

                            // AN EXECUTE ACTION
                            if (helpers.actions[action].execute) {
                                if (testval) {
                                    var sav = [settings.robots[id].pos[0], settings.robots[id].pos[1]];
                                    helpers.actions[action].execute($this, id, settings.robots[id].invert);

                                    var tiletmp = parseInt(helpers.tiles.get($this, settings.robots[id].pos));
                                    var meetsomething = (tiletmp%100>=50);
                                    for (var i in settings.robots) {
                                        meetsomething|=( i!=id && settings.robots[i].active &&
                                                         settings.robots[id].pos[0] == settings.robots[i].pos[0] &&
                                                         settings.robots[id].pos[1] == settings.robots[i].pos[1] );
                                    }
                                    if (meetsomething) {
                                        // ROBOT MEETS A WALL OR ANOTHER ROBOT
                                        settings.robots[id].pos[0] = sav[0];
                                        settings.robots[id].pos[1] = sav[1];
                                        // A GRAPHICAL WARNING
                                        $this.find("#warnfx").show();
                                    }
                                    else {
                                        helpers.update($this, id, settings.robots[id].pos, true);
                                    }
                                    execute = true;
                                }
                                testval = true;
                            } else
                            // A TEST ACTION
                            if (helpers.actions[action].test && testval) {
                                testval = helpers.actions[action].test($this, id);
                            } else
                            // A LOOP
                            if (helpers.actions[action].loop && testval) {
                                var running = settings.robots[id].bt.length &&
                                            (settings.robots[id].fct== settings.robots[id].bt[settings.robots[id].bt.length-1].fct) &&
                                            (settings.robots[id].cp[settings.robots[id].fct] ==
                                                settings.robots[id].bt[settings.robots[id].bt.length-1].cp) ;
                                if (!running) {
                                    // NEW LOOP: UPDATE THE BACKTRACE
                                    var loop = { fct:settings.robots[id].fct, cp:settings.robots[id].cp[settings.robots[id].fct],
                                                count:helpers.actions[action].loop($this, id) };
                                    settings.robots[id].bt.push(loop);
                                }
                                else {
                                    // RUNNING LOOP: UPDATE THE COUNTER
                                    settings.robots[id].bt[settings.robots[id].bt.length-1].count =
                                        helpers.actions[action].loop($this, id,
                                                                    settings.robots[id].bt[settings.robots[id].bt.length-1].count);
                                }

                                // END OF THE LOOP?
                                if (settings.robots[id].bt[settings.robots[id].bt.length-1].count<=1) {
                                    if (settings.robots[id].bt[settings.robots[id].bt.length-1].count<=0) { testval=false; }
                                    settings.robots[id].bt.pop();
                                }
                            }

                            // UPDATE CP
                            if (action=="fct1" || action=="fct2") {
                                if (testval) {
                                    var loop = { from: settings.robots[id].fct, cp:settings.robots[id].cp[settings.robots[id].fct],
                                                to: (action=="fct1")?1:2 };
                                    settings.robots[id].bt.push(loop);
                                    settings.robots[id].fct=loop.to;
                                    settings.robots[id].cp[settings.robots[id].fct]=0;

                                    // INFINITE LOOP
                                    if (settings.robots[id].bt.length>settings.maxbt) {
                                        settings.robots[id].active = false;
                                    }
                                } else {
                                    settings.robots[id].cp[settings.robots[id].fct]++;
                                    testval=true;
                                }
                            }
                            else {
                                settings.robots[id].cp[settings.robots[id].fct]++;
                            }
                        }
                        else { isaction = false; }

                        // END OF A FUNCTION
                        if (!isaction && settings.robots[id].bt.length && settings.robots[id].bt[settings.robots[id].bt.length-1].to) {
                            if (settings.robots[id].bt[settings.robots[id].bt.length-1].to == settings.robots[id].fct) {

                                isaction = true;

                                settings.robots[id].fct = settings.robots[id].bt[settings.robots[id].bt.length-1].from;
                                settings.robots[id].cp[settings.robots[id].fct] =
                                    settings.robots[id].bt[settings.robots[id].bt.length-1].cp+1;
                                settings.robots[id].bt.pop();

                                // SPECIAL TRICKY CASE: FUNCTION LOOP
                                if (settings.robots[id].bt.length && settings.robots[id].bt[settings.robots[id].bt.length-1].count) {
                                    settings.robots[id].fct = settings.robots[id].bt[settings.robots[id].bt.length-1].fct;
                                    settings.robots[id].cp[settings.robots[id].fct] =
                                        settings.robots[id].bt[settings.robots[id].bt.length-1].cp;
                                }

                            }
                            else { alert("ERROR backtrace"); }
                        }

                    } while(!execute && isaction && settings.robots[id].active);

                    // HANDLE THE CP REGARDING THE STACK OF LOOPS
                    if (settings.robots[id].bt.length && settings.robots[id].bt[settings.robots[id].bt.length-1].count) {
                        settings.robots[id].fct = settings.robots[id].bt[settings.robots[id].bt.length-1].fct;
                        settings.robots[id].cp[settings.robots[id].fct] = settings.robots[id].bt[settings.robots[id].bt.length-1].cp;
                        isaction = true;
                    }
                }

                return isaction;
            },
            active: function($this) {
                var settings = helpers.settings($this);
                for (var i in settings.robots) if (settings.robots[i].active) {

                    var active = helpers.tiles.get($this,settings.robots[i].pos);

                    if (active) {
                        if (active%100 == 9) { active = settings.tiles.tile9[Math.floor(active/100)]; }
                    }

                    // ROBOT IS ABOVE A HOLE... LIKE COYOT, IT WILL FALL
                    if (!active) {
                        settings.robots[i].active = false;
                        helpers.update($this, i, 0, true);
                    }

                }
            },
            // EXECUTE THE TILES
            tiles: function($this, _robotsorder, _count, _fct) {
                helpers.zindex($this);
                $this.find("#rtfx>div").hide();
                var settings = helpers.settings($this);
                var toupdate = helpers.execute.active($this);

                for (var i in settings.robots) if (helpers.tiles.execute($this, i)) {
                    toupdate = true;
                    helpers.update($this, i, settings.robots[i].pos, true);
                }

                if (!toupdate) {
                    if (!settings.pause.state) {
                        helpers.execute.run($this, _robotsorder, _count, _fct);
                    } else {
                        settings.pause.order = _robotsorder;
                        settings.pause.count = _count;
                        settings.pause.fct = _fct;
                } }
                else {
                    if (!settings.synchro) {
                        $this.find("#tilefx").show();
                        setTimeout(function() { helpers.execute.tiles($this, _robotsorder,_count,_fct); },helpers.delay($this));
                    }
                    else { helpers.execute.tiles($this, _robotsorder, _count, _fct); }
                }
            }
        },
		speed: function($this, _inc) {
			var settings = helpers.settings($this);
			if (_inc) { settings.speed=(settings.speed+1)%3; }
            $this.find("#speed img").attr("src","res/img/control/x"+(1+settings.speed)+".svg");
		}
    };

    // The plugin
    $.fn.robot = function(method) {

        // public methods
        var methods = {
            init: function(options) {
                // The settings
                var settings = {
                    interactive     : false,
                    tiles           : {
                        size        : [0,0],
                        data        : [],
                        tile9       : [],
                        light       : [],
                        number      : 0
                    },
                    wrong           : 0,
                    synchro         : false,
                    pause           : {
                        state       : false,
                        order       : [],
                        count       : 0,
                        fct         : 0
                    },
                    stop            : false,
                    sourceid        : [0,0,0,0],
                    sourcemax       : [0,0,0,0],
                    testid          : 0,
                    numberinit      : 0,
                    targetoffset    : [0,0],
                    lastcount       : -1,
                    lastelt         : 0,
                    scale           : 1,
                    cc              : { count:0, page:0, timerid:0, available:false, time:0, width:100, pre:0 },
                    tipid           : 0
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
            quit: function() {
                var $this = $(this) , settings = helpers.settings($this);
                settings.interactive = false;
                helpers.end($this,{'status':'abort'});
            },
            next: function() {
                var $this = $(this) , settings = helpers.settings($this);
                settings.interactive = true;
            },
            speed: function() {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.interactive) { helpers.speed($this, true); }
            },
            play: function() {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.interactive) {
                    if (!$this.find("#rtcache").is(":visible")) {
                        settings.stop = false;
                        $this.find("#rtcache").show();
                        $this.find("#play img").attr("src","res/img/control/pause.svg");
                        settings.pause.state = false;

                        // TEST THE WORST SCENARIO
                        if (!settings.worst || !settings.worst.length) {settings.worst = helpers.worst($this); }
                        settings.testid = 0;
                        helpers.execute.launch($this, settings.worst[settings.testid], helpers.endtest, true);
                    }
                    else {
                        if (!settings.synchro) {
                            settings.pause.state = !settings.pause.state;
                            if (settings.pause.state) {
                                $this.find("#play img").attr("src","res/img/control/play.svg");
                            }
                            else {
                                $this.find("#play img").attr("src","res/img/control/pause.svg");
                                helpers.execute.run($this, settings.pause.order, settings.pause.count, settings.pause.fct);
                            }
                        }
                    }
                }
            },
            down: function(_id) {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.interactive) {
                    if (settings.sourceid[_id]<settings.sourcemax[_id]) { settings.sourceid[_id]++; }
                    helpers.updatesource($this);
                }
            },
            up: function(_id) {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.interactive) {
                    if (settings.sourceid[_id]>0) { settings.sourceid[_id]--; }
                    helpers.updatesource($this);
                }
            },
            stop: function() {
                var $this = $(this) , settings = helpers.settings($this);
                settings.stop = true;
                if (settings.pause.state) { helpers.restore($this); }
            },
            tip: function() {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.tipid<settings.tips.length) {
					
					var vRegExp = [
						"\\\[b\\\]([^\\\[]+)\\\[/b\\\]",            "<b>$1</b>",
						"\\\[i\\\]([^\\\[]+)\\\[/i\\\]",            "<i>$1</i>",
						"\\\[br\\\]",                               "<br/>",
						"\\\[blue\\\]([^\\\[]+)\\\[/blue\\\]",      "<span style='color:blue'>$1</span>",
						"\\\[red\\\]([^\\\[]+)\\\[/red\\\]",        "<span style='color:red'>$1</span>",
						"\\\[code\\\](.+)\\\[/code\\\]",            "<div class='cc'>$1</div>",
						"\\\[a\\\]([^\\\[]+)\\\[/a\\\]",            "<div class='icon'><img src='res/img/action/$1.svg' alt=''/></div>",
						"\\\[a1\\\]([^\\\[]+)\\\[/a1\\\]",          "<div class='icon o1'><img src='res/img/action/$1.svg' alt=''/></div>",
						"\\\[a2\\\]([^\\\[]+)\\\[/a2\\\]",          "<div class='icon o2'><img src='res/img/action/$1.svg' alt=''/></div>"
					];
	
					
                    $this.find("#g_tip .g_tnum"+(settings.tipid+1)).removeClass("s").addClass("f")
                         .find(".content").html(jtools.format(settings.tips[settings.tipid],vRegExp));
                         
                    settings.tipid++;
                    $this.find("#g_tbutton>div").html(settings.tips.length-settings.tipid);
                    if (settings.tipid<settings.tips.length) { $this.find("#g_tip .g_tnum"+(settings.tipid+1)).addClass("s"); }
                    $this.find("#g_tvalid").hide();
                    $this.find("#g_tpop").css("opacity",1).show()
                         .animate({opacity:0},1000,function() { $(this).hide(); });
                    settings.wrong++;
                }
            }
        };

        if (methods[method])    { return methods[method].apply(this, Array.prototype.slice.call(arguments, 1)); } 
        else if (typeof method === 'object' || !method) { return methods.init.apply(this, arguments); }
        else { $.error( 'Method "' +  method + '" does not exist in robot plugin!'); }
    };
})(jQuery);

