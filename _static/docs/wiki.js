define([
    "dojo", "dijit", 
    "dojo/text!./CodeGlassMini.html", 
    "dojo/parser", "dojo/fx", 
    "dijit/_Widget", "dijit/form/Button", 
    "dojox/widget/Dialog", 
    "./RstEditor"
], function(dojo, dijit, CodeGlassTemplate){

    var ta = dojo.create("textarea"),
        scriptopen = "<scr" + "ipt>",
        scriptclose = "</" + "scri" + "pt>",
        masterviewer, dialog;
    ;
    
    dojo.declare("docs.MiniGlass", dijit._Widget, {
        
        djconfig:"",
        width:700,
        height:480,
        type:"dialog",
        version:"",
        toolbar:"",
        debug:false,
        themename:"claro",
        baseUrl: dojo.config.baseUrl + "../",
        
        constructor: function(args){
            this.parts = args.parts || {}
        },
        
        postCreate: function(){
            // all we do it put a button in our self to run outself. We don't process the content at all
            this.closer = dojo.place("<a href='#' title='Collapse Example Code' class='CodeGlassMiniCollapser'><span class='a11y'>collapse</span></a>", this.domNode, "first");
            this.button = dojo.place("<a href='#' title='Run Example' class='CodeGlassMiniRunner'><span class='a11y'>run</span></a>", this.domNode, "first");
            this.connect(this.button, "onclick", "_run");
            this.connect(this.closer, "onclick", "_toggle");
            this.inner = dojo.query(".CodeGlassMiniInner", this.domNode)[0];
        },

        // only run processing once:
        _hasRun: false,
        _run: function(e){
            e && e.preventDefault();
            if(!this._hasRun){ 
                this._hasRun = true;
                try{
                    dojo.query("textarea", this.domNode).forEach(this.handlePart, this);
                    this._buildTemplate();
                }catch(er){
                    console.warn("running miniglass threw", er);
                }
            }
            this.show();
        },
        
        _toggle: function(e){
            e && e.preventDefault();
            dojo.toggleClass(this.domNode, "closed");
        },
        
        handlePart: function(n){
            // this is testing the label="" and lang="" attribute. it's html/javascript/css enum
            var t = dojo.attr(n.parentNode, "lang");
            t && this._processPart(t, n.value);
            // rip the old label="" attr and move to a block before. this is the new syntax
            // for codeglass examples, and will be removed from the markup slowly
            var label = dojo.attr(n.parentNode, "label");
            label && dojo.place("<p>" + label + "</p>", n.parentNode, "before");
        },
        
        _processPart: function(type, content){
            if(!this.parts[type]){
                this.parts[type] = []
            }
            
            var orig = content;
            var openswith = d.trim(orig).charAt(0);
            if(type == "javascript" && openswith == "<"){
                // strip the `script` text, this is a special consideration
                // also, this limits each .. js block to a single script tag, FIXME
                orig = orig
                    .replace(/<script[\s+]?.*?>/g, "")
                    .replace(/[\s+]?<\/script>/g, "")
                ;
            }else if(type == "css" && openswith != "<"){
                orig = '<style type="text/css">' + orig + '</style>';
            }

            this.parts[type].push(orig)

        },
        
        template: CodeGlassTemplate,
        _buildTemplate: function(){
            
            this.lazyScripts = [];
            var templateParts = {
                javascript:"<scr" + "ipt src='" + 
                    this.baseUrl + "dojo/dojo.js' djConfig='" + 
                    // fixme: use this.djConfig (or this.pluginArgs.djConfig, I forget)
                    (dojo.isIE ? "isDebug:true, " : "") + 
                    "parseOnLoad:true'>" + scriptclose,
                
                htmlcode:"", 
                
                // if we have a theme set include a link to {baseUrl}/dijit/themes/{themename}/{themename}.css first
                css:'\t<link rel="stylesheet" href="' + this.baseUrl + 'dijit/themes/' + this.themename + '/' + this.themename + '.css">\n\t',
                
                // if we've set RTL include dir="rtl" i guess?
                htmlargs:"",
                
                // if we have a theme set, include class="{themename}"
                bodyargs:'class="' + this.themename + '"',
                
                // 
                head:""
                
            }
            
            var cgMiniRe = /\{\{\s?([^\}]+)\s?\}\}/g,
                locals = {
                    dataUrl: this.baseUrl,
                    baseUrl: this.baseUrl,
                    theme: this.themename
                }
            
            for(var i in this.parts){
                dojo.forEach(this.parts[i], function(item){
                    
                    var processed = dojo.replace(item, locals, cgMiniRe);
                    switch(i){
                        case "javascript":
                            this.lazyScripts.push(processed);
                            break
                        case "html":
                            templateParts['htmlcode'] += processed;
                            break;
                        case "css":
                            templateParts['css'] += processed;
                    }
                }, this);
            }
                        
            // do the master template/html, then the {{codeGlass}} double ones:
            this.renderedTemplate = dojo.replace(this.template, templateParts);
        },
        
        show: function(){
            if(this.type == "dialog"){
                masterviewer.show(this);
            }else{
                console.warn("intended to be injected inline");
                masterviewer.show(this);
            }
        }
                
    });
    
    function addscripttext(doc, code){
        
        var e = doc.createElement("script"),
            how = "text" in e ? "text" :
                "textContent" in e ? "textContent" :
                "innerHTML" in e ? "innerHTML" :
                "appendChild"
        ;
            
        if(how == "appendChild"){
            e[how](dojo.doc.createTextNode(code));
        }else{
            e[how] = code;
        }
            
        doc.getElementsByTagName("body")[0].appendChild(e);

    }
    
    var loadingMessage = "<p>Preparing Example....</p>";
    dojo.declare("docs.CodeGlassViewerMini", null, {

        show: function(who){
            // some codeglassmini instance wants us to show them. 

            if(this.iframe){ dojo.destroy(this.iframe); }
            dialog.set("content", loadingMessage);

            dojo.style(dialog.containerNode, {
                width: who.width + "px",
                height: who.height + "px"
            });
            
            dialog.show();
            console.warn(who.renderedTemplate);
            console.warn(who.lazyScripts);
            setTimeout(dojo.hitch(this, function(){

                var frame = this.iframe = dojo.create("iframe", {
                        style:{
                            height: who.height + "px",
                            width: who.width + "px",
                            border:"none",
                            visibility:"hidden"
                        }
                    });
                
                dialog.set("content", frame);
                
                var doc = frame.contentDocument || frame.contentWindow.document;                
                doc.open();

                doc.write(who.renderedTemplate);

                var scripts = who.lazyScripts, errors = [],
                    inject = function(){
                        dojo.forEach(scripts, function(s){ 
                            addscripttext(doc, s);
                        });
                        
                        dojo.style(frame, {
                            "visibility": "visible",
                            opacity: 0
                        });
                        
                        dojo.anim(frame, { opacity:1 });
                    }
                ;
                
                var e;
                if(frame.addEventListener){
                    e = frame.addEventListener("load", inject, false)
                }else if(frame.attachEvent){
                    e = frame.attachEvent("onload", inject);
                }
                
                setTimeout(function(){ doc.close(); }, 50);
                
            }), dialog.duration + 450);            

        }

    });
        
    dojo.ready(function(){
        
        dojo.parser.parse();
        dialog = new dijit.Dialog({ title:"CodeGlass" });
        masterviewer = new docs.CodeGlassViewerMini();
        dojo.query(".live-example").forEach(function(n){
            var link = dojo.place("<a href='#' title='Example Code'><span class='a11y'>?</span></a>", n, "first");
            var data = dojo.query(".closed", n)[0];
            dojo.connect(link, "onclick", function(e){
                e && e.preventDefault();
                dojo.toggleClass(data, "closed");
            });
        });
    });
    
});
