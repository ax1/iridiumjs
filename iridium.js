if (console) console.info("iridium.js 0.5.2");

//TODO add prototype to router and view objects (as controller does)
var $;
if (!$) alert('jQuery is required!!!');
var iridium=function(customNamespace,startTag,endTag){

    var namespace="iridium";

    var tag1=startTag || "{{";
    var tag2=endTag || "}}";

    var c={
        session:"session",
        layerLog:"layer-log",
        authorization:"Authorization",
        data_container:"data-container",
        data_target:"data-target",
        data_model:"data-model",
        data_bind:"data-bind",
        data_value:"data-value",
        data_status:"data-status",
        data_skeleton:"data-skeleton",
        data_provider:"data-provider",
        data_event:"data-event",
        data_load:"data-load",
        data_options:"data-options",
        data_:"data-",
        create:"create",
        read:"read",
        update:"update",
        delete:"delete",
        remove:"remove" //TODO erase remove after delete keyword is checked (ES6)
    };

    function cssAttribute(attr,value){
        if (!value && value!=='') {return "["+attr+"]"; }
        else {return "["+attr+"='"+value+"']";}
    }

    /**
     * Execute a function without using eval
     * See www.sitepoint.com/call-javascript-function-string-without-using-eval/
     * @param functionName the function name to be executed
     * @param params [OPTIONAL] array of params to be used as input params
     * @param scope [OPTIONAL] The object to search for the function definition.if scope is not set, the global scope is used (window)
     * @return the value returned from the function call
     */
     //TODO improve this method by:
             // 1-using apply(this,params) instead of apply(null),
            // 2-check if the scope can be autodetected, or taken from the caller of this function,
    function run(functionName,params,scope){
        var myParams;
        if (!params) myParams=[];
        if (!scope) scope=window;
        var fn = scope[functionName];
        if (typeof fn === "function") return fn.apply(scope, myParams);
    }

    /**
     * Execute a function only when an external variable has been loaded.
     * This function is really useful when a page is loaded, and the page contains <script src="url"> along with <script>varName?;;</script> tags.
     * The external source is loaded asynchronously, so if we try to use a variable from that src, it could be undefined.
     * This is a better way to execute a function, instead of a fixed setTimeout (callback, milliseconds) in your code.
     * @param variableName the name of the variable to check its availability
     * @param scope the object containing that variable definition (eg:window["variableName"], scope is window)
     * @param milliseconds [OPTIONAL] the maximun time to poll for availability of thet variable
     * @param callback the name of the function, or the function itself, to be executed when the variable is available
     * This method polls if the variable is already available,and then execute our custom function.
     */
    function onAvailable(variableName,scope,milliseconds=1000,callback){
      if (!scope) scope=window;
      var variable=scope[variableName];
      if(typeof variable!=='undefined'){callback();}
      else{
        milliseconds=milliseconds-10;
        setTimeout(function(){onAvailable(variableName,scope,milliseconds,callback)},10);
      }
    }

    /**
     * Return either the full querystring or the value of a key in the querystring
     * @param key the id to get the value, if !key, the full querystring is returned as '';
     */
    function queryString(key){
        //normal querystring is location.search, but when routing with hash, the location.search is empty
        var href=location.href;
        var index=href.indexOf("?");
        if (index>-1){
            var q=href.substring(index+1);
            q=sanitize(q);
            if (!key){
                return q;
            }else{
                var data=q.split('&');
                var value='';
                for (var i = 0; i < data.length; i++) {
                    var kv = data[i].split('=');
                    if (kv[0]===key){
                        value=decodeURIComponent(kv[1] || '');
                        break;
                    }
                }
                return value;
            }
        }else{
            return '';
        }
    }

    /**
    * Generic ajax call.
    * Usage: ajax(url,method,payload).done(function(){//your function});
    * @param context Optional,the 'this' object in the ajax response. Default is ajaxsettings (jquery default)
    * @param responseType Optional, the type of the expected response .default is undefined,null or '*'.
    */
    var ajax=function(url,method,payload,context,responseType){
        if (!method) method="get";
        var dataType= responseType|| '*';
        return $.ajax({
        headers:headers,
        url: url,
        cache:false,
        type: method,
        data: payload,
        dataType: dataType,
        context:context,
        beforeSend: function(){hideLog();}
        })
        .always(function(data, textStatus, jqXHR_or_Error) {
        })
        .fail(function( jqXHR, textStatus, errorThrown) {
            processAjaxFailResponse(jqXHR, textStatus, errorThrown);
        });
    };

    /**
    * Call Ajax, expecting a JSON response. The response (data) will become a js object.
    * This method is useful when the server is sending json data but no mime type is set (in headers, or guessed from the file extension, for instance, a plain txt page.
    */
    var ajaxJSON=function(url,method,payload,context){
        return ajax(url,method,payload,context,"json");
    };

    function processAjaxFailResponse(jqXHR, textStatus, errorThrown){
        var statusCode=jqXHR.status;
        if((statusCode===0) && errorThrown===""){
            statusCode=503;
            errorThrown="Service Unavailable";
        }else if(statusCode==401){
            ir.security().removeAuthenticated();
              location.href=location.protocol+"//"+location.host+location.pathname;
        }
        showErrorLog(statusCode +" "+errorThrown);
    }

    function insertHeaders(){
        var keyValue = document.cookie.match('(^|;) ?' + c.authorization + '=([^;]*)(;|$)');
        headers[c.authorization]=keyValue ? keyValue[2] : null;
    }

    /**
    * Look into an object,and find a deep property, then return the parent object
    * Example: obj={a:1,b:{b1:0,b2:8}} and key=b.b2
    * @return {object or array} the parent object
    */
    function getObjectPropertyParent(key, object){
      if (typeof(key)==='number') key=key.toString();
      var obj=object;
      try{
        var data = key.split('.');
        if (data.length===1) return object;
        while(data.length>1){
          obj = obj[data.shift()];
        }
        return obj;
      }catch(error){
        console.error("No object found when looking for key='"+key+"'."+error);
        return obj;
      }
    }

    /**
    * Look into an object,and find a deep property
    * Example: obj={a:1,b:{b1:0,b2:8}} and key=b.b2
    * @return {any} the value
    */
    function getObjectProperty(key, object){
      var obj=getObjectPropertyParent(key, object);
      if (typeof(obj)==='undefined') return undefined;
      else return obj[key.split('.').pop()]||"";
    }

    /**
    * Set a deep property value into an object
    * Note: if the property is not found, this method will create it
    * Example: obj={a:1,b:{b1:0,b2:8}} and key=b.b2 and value=10
    */
    function setObjectProperty(key, value, object){
      var obj=getObjectPropertyParent(key, object);
      obj[key.split('.').pop()] = value;
    }

    /**
    * Add required css style when page is loaded
    * This function is just to avoid having a css file
    */
    function addCSS(){
        var style=
            "<style>"+
                "[data-model]{display:none}"+
                "[data-model][data-status]{display:block}"+
            "</style>";
            $('body').prepend(style);
    }

    function createLayerLog(){
        if($("#"+ c.layerLog).length === 0){
            var style="<style>#"+c.layerLog +"{display:none;position: fixed; width:30%; margin: 0 0 0 -15%;left:50%;background-color:rgba(255,0,0,0.8);text-align:center;z-index:100000;top:0%;font-weight:bold;padding:0.1em;border-radius:3px}</style>";
            var element='<div id="'+c.layerLog+'" > </div>';
            $('body').prepend(style+"\n"+element);
        }
    }

    var pagesStillLoading={};

    /**
     * Execute some generic code after the view was loaded.
     * Note: use functionDone for custom functions.
     */
    function checkAndExecuteFunctionAfterViewsLoaded(url){
        delete pagesStillLoading[url];
        //(ALREADY LOADED WHEN CONFIGURE ROUTER->READ(either from controller().configure or from data-provider))
        $("["+c.data_model+"]:not(["+c.data_status+"])").each(function( ) {
            paintToTemplate(this.getAttribute(c.data_model));
        });
        //after page loaded execute custom function
        if($.isEmptyObject(pagesStillLoading)){
            if(funcToCallAfterViewLoaded){
                if (typeof funcToCallAfterViewLoaded==='function'){
                    funcToCallAfterViewLoaded();
                }else if (typeof funcToCallAfterViewLoaded==='string'){
                    run(funcToCallAfterViewLoaded);
                }else{
                    console.error(funcToCallAfterViewLoaded +"is not a function or an String. It cannot be executed (related to '"+url+"')");
                }
            }
        }

    }

    /**
     * Load all child pages inside the containers. Any container must have the data-load property containing the url to be loaded.
     */
    function loadChildPages(){
      $("["+c.data_load+"]").each(function( ) {
          var url=this.getAttribute(c.data_load);
          _load(url,cssAttribute(c.data_load,url));
      });
    }

    /*
    ██       ██████   █████  ██████
    ██      ██    ██ ██   ██ ██   ██
    ██      ██    ██ ███████ ██   ██
    ██      ██    ██ ██   ██ ██   ██
    ███████  ██████  ██   ██ ██████
    */


    /**
     * Load an html/js page (generic method)
     */
    function _load(url,selector,callback){

        /**
         * calculate the real selector of the container to be loaded
         * if no valid selector is given, the default selector is taken from the url
         * Example: url="users/details.php?user=smith", the selector will be css="#details"
         */
        function calculateContainerSelector(url,selector){

            function testDuplicatedContainer(url,selector){
                if($(selector).length>1) console.warn("Container '"+selector+"' is not unique (it should be most of the cases). The content of page "+url+" will be loaded into the first one");
            }

            var originalSelector=selector;
            testDuplicatedContainer(url,selector);
            if( $(selector).length===0){
                //no valid selector, find the best container for the page to be loaded
                if(selector && selector.trim().startsWith('#')===false){
                  selector="#"+selector;
                  testDuplicatedContainer(url,selector);
                }
                if($(selector).length===0){
                    var addr=url;
                    var index=addr.indexOf("?");
                    if (index>-1) addr=addr.substring(0,index);
                    index=addr.lastIndexOf("/");
                    if (index===addr.length-1) addr=addr.substring(0,index);
                    index=addr.lastIndexOf("/");
                    if (index>-1) addr=addr.substring(index+1);
                    index=addr.lastIndexOf(".");
                    if (index>-1) addr=addr.substring(0,index);
                    selector="#"+addr;
                    testDuplicatedContainer(url,selector);
                    if($(selector).length===0) {
                        testDuplicatedContainer(url,selector);
                        selector=cssAttribute(c.data_container);
                        testDuplicatedContainer(url,selector);
                        if($(selector).length===0) {
                            selector="body";
                            console.error("container for url "+url+" is " +originalSelector+", but there is no DOM element related to that container, using default("+selector+")" );
                        }
                    }
                }
            }
            return selector;
        }


        try{
            pagesStillLoading[url]=true;
            console.log('loading '+url);
            if (url==='') {
                //default container so the content is already loaded, just execute the methods to render templates
                checkAndExecuteFunctionAfterViewsLoaded(url);
            }else{
                //any other selector, download page and then execute methods
                selector=calculateContainerSelector(url,selector);
                callback=callback || function(){};
                var callbacks=function(){
                    callback();
                    checkAndExecuteFunctionAfterViewsLoaded(url);
                };
                _unload(selector);//remove existing data & events
                $(selector).load(url,callbacks);
            }
        }catch(e){
            console.error(e);
        }
    }

    function _unload(selector){
        var elContainer=document.querySelector(selector);
        if (elContainer){
            var templates=elContainer.querySelectorAll(cssAttribute(c.data_model));
            for (var i = 0; i < templates.length; i++) {
                var template=templates[i];
                var templateName=template.getAttribute(c.data_model);
                if (controllers[templateName]) controllers[templateName]._();
            }
        }
        $(selector).empty();
    }

    /*
████████ ███████ ███    ███ ██████  ██       █████  ████████ ███████ ███████
   ██    ██      ████  ████ ██   ██ ██      ██   ██    ██    ██      ██
   ██    █████   ██ ████ ██ ██████  ██      ███████    ██    █████   ███████
   ██    ██      ██  ██  ██ ██      ██      ██   ██    ██    ██           ██
   ██    ███████ ██      ██ ██      ███████ ██   ██    ██    ███████ ███████
*/

    /**
     * Given a expression retrieve value
     * if key=key->current model, value from object
     * if key=session:key->retrieve data from session
     * if key=name:key-> retrieve key from other model
     * if key=$queryString-> retrieve the full querystring
     * if key=$queryString:key-> retrieve the querystring key
     */
    function processExpression(controllerName,key,object){

        function process(controllerName,key,object){
            //querystring is special, it can contain no keys
            if(key==="$queryString" || key==="$querystring") return queryString();
            var index=key.indexOf(":");
            if(index<0){
              //--------CURRENT MODEL----------------
                //key is a function instead a value.if function() with no params, add 'this' object, for magic features
                let pos=key.indexOf("(");
                if(pos>-1){
    //                if (key.indexOf("()")>-1) key=key.substring(0,pos+1)+"this"+key.substring(pos+1);
                    return "ir.controller('"+controllerName+"')."+key;
                }else{
                    return getObjectProperty( key, object);
                }
            }else{
              //---------EXTERNAL MODEL--------------
                var prefix=key.substring(0,index);
                key=key.substring(index+1);
                if(prefix.indexOf("$")>-1){
                    var variable=prefix.substring(1);
                    if(variable==="localStorage"){
                        return window.localStorage.getItem(key);
                    }else if (variable==="sessionStorage"){
                        return window.sessionStorage.getItem(key);
                    }else if (variable==="queryString"){
                        return queryString(key);
                    }
                }else{
                    //extract data from external model
                    var modelName=prefix;
                    if (!modelName) modelName='';
                    subscriptions.put(modelName,controllerName);
                    try{
                      let pos=key.indexOf("(");
                      if(pos>-1){
                          //if (key.indexOf("()")>-1) key=key.substring(0,pos+1)+"this"+key.substring(pos+1);
                          return "ir.controller('"+modelName+"')."+key;
                      }else{
                        return controllers[modelName].model.get(key);
                      }
                    }catch(err){
                      console.error(err);
                      return "ERROR";
                    }
                }
            }
        }

        return sanitize(process(controllerName,key,object));
    }

    /**
     * Search for {{keys}} and replace brackets by real object values
     * @returns object with old and new text, undefined if name hasn't got any {{}} inside
     */
    function lookupExpression(controllerName,text,object){
        if(!text) return undefined;
        var found=false;
        var index1=text.indexOf(tag1);
        var index2=-1;
        if(index1>-1){
            found=true;
            index2=text.indexOf(tag2);
            var key=text.substring(index1+tag1.length,index2);
            var value=processExpression(controllerName,key,object);
            if(value===undefined || value===null) value="";
            var newText;
            if (typeof value==='object'){
              newText=JSON.stringify(value);
            }else{
              newText=text.substring(0,index1)+value+text.substring(index2+tag2.length);
            }
            return{
                oldText:text,
                newText:newText,
                expression:key,
                value:value,
                index1:index1,
                index2:index2+tag2.length,
                found:found
            };
        }else{
            return undefined;
        }
    }

    function sanitize(text){
        //TODO implement (for instance if querystring contains script or similar)
        //AND merge with sanitizeText
        return text;
    }

    /**
     * prevent hacking
     * //TODO IMPORTANT: wether you escape or not, the main work on sanitize must be IN THE SERVER SIDE (the client can always be hacked)
     */
    function sanitizeText(el,text){
        //if <a>, disable javascript injection via href
        if(el.nodeName.toLowerCase()==="a"){
            var index=text.indexOf("javascript");
            if (index>-1){
                var t1=text.substring(index+"javascript".length).replace(/ /g,"");
                var index2=t1.indexOf(":");
                if(index2===0) return text.replace(/javascript/g,"javascript_disabled");
            }
        }
        return text;
    }


    /**
     * Initialize the template the first time AND
     * Paint model data to html tags
     */
    var paintToTemplate=function(templateName){


        /**
         * parse {{}} in attributes
         */
        function parseAttributes(templateName, el,jEl, object){

            function parseAttribute(attr){
                if (attr.value.indexOf(tag1)===-1) return;//if nothing to process->exit as fast as possible

                //----------------------------------------------------------
                //      process several '{{}}{{}}' in the same sentence
                //----------------------------------------------------------
                var expression=attr.value;
                var res;
                while(expression.indexOf(tag1)>-1){
                    res=lookupExpression(templateName,expression,object);
                    expression=sanitizeText(el,res.newText);
                }
                //add to real html attribute the processed value
                var realAttrName=attr.name.substring(c.data_.length);
                //----------------------------------------------------------
                //      if real attribute->set real values
                //----------------------------------------------------------
                if(jEl.attr(realAttrName) && jEl.attr(realAttrName)!==expression) {
                  jEl.attr(realAttrName,expression);
                }
                //----------------------------------------------------------
                //       if value->insert into nodeText
                //----------------------------------------------------------
                if(attr.name===c.data_value){
                    if(el.nodeName.toLowerCase() === "input"){
                        var attrBind=jEl.attr(c.data_bind);
                        if(!attrBind){
                            jEl.attr(c.data_bind,res.expression);
                            jEl.val(res.newText);
                            jEl.on("input change inputText",function(event){
                                var val=$(this).val();
                                controllers[templateName].model.set($(this).attr("data-bind"),val); //TODO ARF 13-10-15 check if event propagation is suitable (see $.on documentation). And check if it is better performance solution that the current one since every time a new input is created, it should update model , the tag itself, etc. Maybe the curent solution is already the good one.
                            });
                        }
                    }else{
                        jEl.text(res.value);
                    }
                }

            }

            function parseALLAttributes(templateName, el,jEl){
                //create the data-* if not presented
                    for(var i=0;i<el.attributes.length;i++){
                        var attr=el.attributes[i];
                        if(attr.value.indexOf(tag1)>-1){
                            //if reserved html (href, target, etc) attribute->CREATE the related data-attribute
                            if(attr.name.indexOf(c.data_)===-1){
                                if(!jEl.attr(c.data_+attr.name)){
                                    jEl.attr(c.data_+attr.name,attr.value);
                                    i=0;//reset index because attributes map has changed
                                    continue;//go back to loop
                                }
                            }
                        }
                    }
                //lookup in ATTRIBUTES
                for(var r=0;r<el.attributes.length;r++){
                    parseAttribute(el.attributes[r]);
                }
            }


            parseALLAttributes(templateName, el,jEl);
        }

        /**
         * parse {{}} in element contents
         */
        function parseContent(templateName, el,jEl, object){
          var nodes=el.childNodes;
          for (var r=0;r<nodes.length;r++){
            var node=nodes[r];
            if (node.nodeType==3){//IF TEXT
              if (node.data.indexOf(tag1)===-1) continue;
              var res=lookupExpression(templateName,node.data,object);
              //if {{}} create the <span> nodes
              if(res && res.found){
                var node1=document.createTextNode(res.oldText.substring(0,res.index1));
                var node2=document.createElement("span");node2.setAttribute("data-value",tag1+res.expression+tag2);node2.data=res.value;
                var node3=document.createTextNode(res.oldText.substring(res.index2));
                node.parentNode.insertBefore(node1,node);node.parentNode.insertBefore(node2,node);node.parentNode.insertBefore(node3,node);
                node.parentNode.removeChild(node);
                r=0;//reset loop
              }
            }
          }
        }

        /**
         * parse {{}} in child elements
         */
        function parseChildren(templateName, el,jEl, object){
            //lookup in CHILD ELEMENTS
            if(el.children.length>0){
                for(var s=0;s<el.children.length;s++){
                    var elChild=el.children[s];
                    if(elChild.attributes[c.data_model]) {
                        paintToTemplate(elChild.getAttribute(c.data_model)); //if other template is found, bypass (it will be managed by another controller)
                    } else if(elChild.attributes[c.data_skeleton]){
                      // do not process data-skeleton
                    }else {
                      paintNodes(templateName,elChild,$(elChild),object);
                    }
                }
            }
        }

        /**
         * if data-model='details' everything is ok
         * if data-model='details_{{index}}' the template name should be changed and attached to controller (if exists)
         */
        function checkDynamicTemplateName(templateName, elTemplate){
            var model=templateName;
            var provider=elTemplate.getAttribute(c.data_provider);
            if (model.indexOf(tag1)===-1 && (!provider || provider.indexOf(tag1)===-1)) return model;//static template, exit
            //object. the dynamic template should take a value from his parent template "{{a}}", or explicit template "{{myTemplate:a}"
            var object;
            var jParent=$(elTemplate).parents(cssAttribute(c.data_model));
            if(jParent.length>0){
                var parentTemplateName=jParent.attr(c.data_model);
                object=controllers[parentTemplateName].model.obj;
            }
            //check-data-model
            var res1=lookupExpression(templateName, model, object);
            if (res1){
                var newTemplateName=res1.newText;
                var attr=cssAttribute(c.data_model,newTemplateName);
                if(document.querySelector(attr)) throw (namespace+": "+attr+" is already in the document");
                elTemplate.setAttribute(c.data_model,res1.newText);
                model=res1.newText;
            }
            //check data-provider
            var res2=lookupExpression(model, provider, object);
            if (res2) {
                provider=res2.newText;
                elTemplate.setAttribute(c.data_provider,provider);
                if(controllers[model]) throw (namespace+": controller name: "+model+" and provider:"+provider+" is an existing controller. Either remove it or just overwrite it");
                //controllers[model]=controller(model);
            }
            //if changed, load provider async(ajax), and don't paint until the data is downloaded
            // if(res1 || res2){
            //     //controllers[model].configure(provider);
            //     return true;
            // } else {
            //     return false;
            // }
            return model;
        }

        /**
         * If controller definition is in template tag, it must be configured first;
         * Note: a template may not have a data-provider tag or ir.controller, in that case, create an empty one
         */
        function checkIfControllerIsConfiguredAndReady(templateName,elTemplate){
            var model=templateName;
            var provider=elTemplate.getAttribute(c.data_provider);
            var options=elTemplate.getAttribute(c.data_options);
            if(!provider){
              if (controllers[model]){
                return true;
              }else{
                elTemplate.setAttribute(c.data_provider,"{}");//create an empty controller
                provider=elTemplate.getAttribute(c.data_provider);
              }
            }
            if(provider && !controllers[model]){
                var cr=controller(model);
                controllers[model]=cr;
                cr.configure(provider,null,options);
                return false;
            }else{
                if (controllers[model].isConfigured===false){
                  controllers[model].configure(provider,undefined,options);
                  return false;
                }
                if (controllers[model].isReady===false) return false;
                else return true;
            }
        }

        /**
         * Based on the template syntax, data is rendered.
         * Note: the template syntax is not replaced, new attributes are created in elements, to keep that syntax while replacing with real data
         * @param {string} templateName the name of the template that is currently processed
         */
        function paintToTemplate(templateName){
            //alert(templateName);
            var selector=cssAttribute(c.data_model,templateName);
            var jTemplate=$(selector);
            if (jTemplate.length<=0) {
                console.warn("template '"+templateName+" ',the selector ' '"+selector+"' was not found. If you are trying to render data to HTML (templates), this is an ERROR. On the other side, if you just want to perform REST calls and process the data with javascript, this is an INFO messsage.");
                return;
            }
            var elTemplate=jTemplate[0];
            if(!elTemplate) return;
            //if the parent template is not inited yet, wait for initialization before painting this templates
            var jParent=jTemplate.parents(cssAttribute(c.data_model));
            if(jParent.length>0){
                var parentTemplateName=jParent.attr(c.data_model);
                if (!controllers[parentTemplateName] || controllers[parentTemplateName].isReady===false){
                    return;//exit and wait, this template will be painted when its parent template is ready to process the content
                }
            }
            var newTemplate=checkDynamicTemplateName(templateName, elTemplate);
            if(templateName!==newTemplate){
                //dynamic template, the controller has been configured and it will call this method later, so exit.
                paintToTemplate(newTemplate);
                return;
            }
            if(checkIfControllerIsConfiguredAndReady(templateName,elTemplate)===false)  {
                return; //asynchronous call-wait for configuration process finished. When the controller has retrieve data, it will call paintToTemplate again
            }
            var object=controllers[templateName].model.obj;
            console.debug("painting template '" +templateName+"'");
            //paint nodes
            paintNodes(templateName,elTemplate,jTemplate,object);
            //if template was not inited yet->all processed->mark as inited
            if(!jTemplate.attr(c.data_status)){
                jTemplate.attr(c.data_status,"inited");
            }
        }

        /**
         * Check type of data (array, object) and process nodes.
         * Note: the template syntax is not replaced, new attributes are created in elements, to keep thant syntax while replacing with real data
         * @param templateName the name of the template that is currently processed
         * @param el the DOM element to be processed, el can be a dom object OR a css selector
         * @param jEl the $(el), passed as param just for performance purposes
         * @param object the data from the model to be inserted into the DOM
         * @param el the DOM element to be processed, el can be a dom object or a css selector
         */
        function paintNodes(templateName,el,jEl,object){
            if(!(el instanceof HTMLElement)){//TODO review this if (maybe deprecated)
                 el=$(el)[0];
                jEl=$(el);
            }
            //(el.attributes[c.data_skeleton]) return;//if skeleton, do nothing
            if(object instanceof Array && el.hasAttribute(c.data_model)){
                let array=object;
                //if template not processed, copy all child nodes into a hidden container
                let elSkeleton=el.querySelector(cssAttribute(c.data_skeleton));
                if (!elSkeleton){
                    //create skeleton
                    elSkeleton=document.createElement("div");
                    elSkeleton.style.display="none";
                    elSkeleton.setAttribute(c.data_skeleton,"");
                    while (el.children.length>0){elSkeleton.appendChild(el.children[0]);}
                    el.appendChild(elSkeleton);
                }
                //create the list elements
                let skeleton=elSkeleton.innerHTML;
                let text="";
                array.forEach(function (item,index,arr){
                    let newText=skeleton.replace(/\{\{0}}/g,"{{"+index+"}}");
                    newText=newText.replace(/\{\{0\./g,"{{"+index+".");
                    text=text+newText;
                });
                el.innerHTML=text+elSkeleton.outerHTML;
                //if skeleton then bypass
                let nodeList=elSkeleton.querySelectorAll(cssAttribute(c.data_model));
                for(let s=0;s<nodeList.length;s++){nodeList[s].setAttribute(c.data_status,"inited");}
                //continue with child elements
                parseChildren(templateName, el,jEl, object);
            }else{
                parseAttributes(templateName, el,jEl, object);
                parseContent(templateName, el,jEl, object);
                parseChildren(templateName, el,jEl, object);
            }

        }


        paintToTemplate(templateName);

    };

    var headers={};
    var routers={};
    //var views={};
    var controllers={};
    //var models; models are already in sessionStorage
    //var templates; templates are already in the html files

    /*
    ███████ ███████ ███████ ███████ ██  ██████  ███    ██
    ██      ██      ██      ██      ██ ██    ██ ████   ██
    ███████ █████   ███████ ███████ ██ ██    ██ ██ ██  ██
         ██ ██           ██      ██ ██ ██    ██ ██  ██ ██
    ███████ ███████ ███████ ███████ ██  ██████  ██   ████
    */

    //Session is intended to keep data (not in the url) between pages or when refreshing the page. I.e: the user id if the user is logged
    //Session is different than headers & cookies since these ones are sent to the server on each request

    var session=function(){
        var sessionObject={};
        var sessionKey=namespace+".session";
        function getKeyObject(key,object){
            var keys=key.split(".");
            var obj=object;
            for (var r=0; r<keys.length -1;r++){
                if (!obj[keys[r]]) obj[keys[r]]={};
                obj=obj[keys[r]];
            }
            return obj;
        }
        var get=function(key){
            return getKeyObject(key,sessionObject)[key];
        };
        var set=function(key,value){
            var obj= getKeyObject(key,sessionObject);
            obj[key]=value;
            if(sessionStorage) sessionStorage.setItem(sessionKey,JSON.stringify(sessionObject));
        };
        if(sessionStorage) {
            if (sessionStorage.getItem(sessionKey)) sessionObject= JSON.parse(sessionStorage.getItem(sessionKey));
        }
        return{
            get:function(key){return get(key);},
            set:function(key,value){set(key,value);}
        };
    }();

    /*
    ██████   ██████  ██    ██ ████████ ███████ ██████  ███████
    ██   ██ ██    ██ ██    ██    ██    ██      ██   ██ ██
    ██████  ██    ██ ██    ██    ██    █████   ██████  ███████
    ██   ██ ██    ██ ██    ██    ██    ██      ██   ██      ██
    ██   ██  ██████   ██████     ██    ███████ ██   ██ ███████
    */

    var router=function(name){
        if (routers[name]){
            return routers[name];
        }else{
            var routerFunction=function(){};
            var router={
                configure:function(func){routerFunction=func;}/*function() or function(params)*/,
                run:function(querystring){routerFunction(querystring);/*querystring(params) is optional*/},
                remove:function(){delete routers[name];}
            };
            routers[name]=router;
            return router;
        }
    };

    var temporaryCustomClick={
        router:undefined,//the router to execute the function, just once
        func:undefined,//a custom function to be executed just ONCE. Different than RouterFunction (executed on every call);
        new:false//detect if the custom function will be called asynchronously
    };

    var firstTime=true;//check if page is reloaded from the browser
    var funcToCallAfterViewLoaded;//buffer object to detect if a function must be called

    /**
     * When location.hash changes, decide which pages should be rendered
     * if #hash, a standart html document anchor is located, so this method exits inmediatly
     * if #/hash,  a page (hash) should be loaded
     * This function is called whenever the hash in browser location has changed
     */
    function processRoute(){
        var hash=location.hash;
        if(hash.length>1 && hash.indexOf("/")!=1 ) return;//a normal html anchor
        if(hash==="#" || hash==="#/") hash='';
        //
        //IF FIRST TIME & HASH, load default router first
        //
        if(firstTime && hash!==''){
            console.log('processing router FIRST time '+location.hash+" default router '' will be loaded ");
            funcToCallAfterViewLoaded=processRoute;
            hash='';//execute default hash
        }else{
            funcToCallAfterViewLoaded=undefined;
            console.log("processing router  '"+location.hash+"'");
            if (temporaryCustomClick.new===true){
                if(temporaryCustomClick.router===hash) {
                    funcToCallAfterViewLoaded=temporaryCustomClick.func;
                    temporaryCustomClick.new=false;
                }
            }
        }
        //
        // PROCESS ROUTER
        //
        firstTime=false;
        hideLog();
        if(hash===''){
            if(!routers['']) router('').configure(function(){_load('');});
            routers[''].run();
        }else{
            var $el=$(cssAttribute("href",hash));
            if($el.length>1) console.warn("duplicated href elements("+hash+"), maybe they target different containers.");
            if($el.length<1) console.warn("no target is defined for hash '"+hash+"'");

            var url=hash.substring(2);//details.html?a1=1&a2=2
            var id=url;//details.html
            var querystring;//a1=1&a2=2
            var index=id.indexOf("?");
            if (index>-1) {
                querystring=id.substring(index+1);
                id=id.substring(0,index);
            }
            //calculate target (warning: use [data-target] or none because [target] opens a new window)
            var target;
            if($el.length==1){
                if($el.attr(c.data_target)) target=$el.attr(c.data_target);
                //else if($el.attr("target")) target=$el.attr("target");
            }
            var rt=routers[id];
            if(rt) {
                rt.run(querystring);
            }else{
                _load(url,target);
            }
        }
    }

    /*
    ███████ ██    ██ ██████  ███████  ██████ ██████  ██ ██████  ████████ ██  ██████  ███    ██ ███████
    ██      ██    ██ ██   ██ ██      ██      ██   ██ ██ ██   ██    ██    ██ ██    ██ ████   ██ ██
    ███████ ██    ██ ██████  ███████ ██      ██████  ██ ██████     ██    ██ ██    ██ ██ ██  ██ ███████
         ██ ██    ██ ██   ██      ██ ██      ██   ██ ██ ██         ██    ██ ██    ██ ██  ██ ██      ██
    ███████  ██████  ██████  ███████  ██████ ██   ██ ██ ██         ██    ██  ██████  ██   ████ ███████
    */


    var subscriptions={
      obj:{},
      get:function(topic){
        return this.obj[topic] || [];
      },
      put:function(topic,subscriptor){
        if (this.obj[topic]===undefined) this.obj[topic]=[];
         if(this.obj[topic].includes(subscriptor)===false) this.obj[topic].push(subscriptor);
      },
      clean:function (name){
        delete this.obj[name];
        for (let topic of this.obj){
          let subscriptors= this.obj[topic];
          if (subscriptors){
            for (let i = subscriptors.length-1; i--;){
              if (subscriptors[i] === name) subscriptors.splice(i, 1);
            }
          }
        }
      }
    }

    /*
    ███    ███  ██████  ██████  ███████ ██      ███████
    ████  ████ ██    ██ ██   ██ ██      ██      ██
    ██ ████ ██ ██    ██ ██   ██ █████   ██      ███████
    ██  ██  ██ ██    ██ ██   ██ ██      ██           ██
    ██      ██  ██████  ██████  ███████ ███████ ███████
    */

    var model=function(name,controller){

        var model={
          name:name,
          obj:{} /*obj can be {} or []*/,
          get:function(key){return getObjectProperty(key, this.obj);},
          set:function(key,value){
            //TODO:SECURITY, PREVENT CODE INJECTION
            ///value=encodeURI(value);
            setObjectProperty(key,value,this.obj);
            this.execute();
          },
          add:function(key,value){
            var obj=getObjectPropertyParent(key,this.obj);
            if(Array.isArray(obj)){
              obj.splice(key,0,value);
            }else{
              obj[key]=value;
            }
            this.execute();
          },
          remove:function(key){
            var obj=getObjectPropertyParent(key,this.obj);
            if(Array.isArray(obj)){
              obj.splice( key, 1 );
            }else{
              delete obj[key];
            }
            this.execute();
          },
          execute(){
            if(controller.options && controller.options.indexOf("autosave")>-1){
              controller.update().then((controller)=>paintToTemplate(controller.name));
            }else paintToTemplate(this.name);
            //notify also the external objects looking for values in this model
            for (let subscriptor of subscriptions.get(this.name)) paintToTemplate(subscriptor);
          },
          get length(){
            if (this.obj===undefined || this.obj===null) return -1;
            else return this.obj.length;
          }
        };
        return model;
    };

    /*
     ██████  ██████  ███    ██ ████████ ██████   ██████  ██      ██      ███████ ██████  ███████
    ██      ██    ██ ████   ██    ██    ██   ██ ██    ██ ██      ██      ██      ██   ██ ██
    ██      ██    ██ ██ ██  ██    ██    ██████  ██    ██ ██      ██      █████   ██████  ███████
    ██      ██    ██ ██  ██ ██    ██    ██   ██ ██    ██ ██      ██      ██      ██   ██      ██
     ██████  ██████  ██   ████    ██    ██   ██  ██████  ███████ ███████ ███████ ██   ██ ███████
    */

    var controller=function(name){

        function controller(name){
            this.name=name;
            this.url=undefined;
            this.model=model(name,this);
            this.template=cssAttribute(c.data_model,this.name);
            this.isConfigured=false;//when configure() has been called,it will set isReady when read() is retrieved. A controller can exists but not configure when for instance, new methods are added before configuring
            this.isReady=false;//when configure() and read() has been called, therefore we can paint  data to template
            this.options="";
            this.customMethods={};
        }

        function callCustomOK(objectController,method){
            if(objectController.customMethods[method] && objectController.customMethods[method][0]) {
                objectController.customMethods[method][0](objectController);
            }
        }

        function callCustomERROR(objectController,method){
            if(objectController.customMethods[method] && objectController.customMethods[method][1]){
                objectController.customMethods[method][1](objectController);
            }

        }

        controller.prototype.create=function(){
            var objectController=this;
            var promise=new Promise(
                function(resolve,reject){
                    //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
                    var url=objectController.url;
                    var storage;
                    if (url.startsWith("localStorage/")){
                      storage=localStorage;
                    } else if (url.startsWith("sessionStorage/")){
                      storage=sessionStorage;
                    }
                    //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
                    if (storage){
                      let key=url.substring(url.indexOf('/')+1);
                      storage.setItem(key,JSON.stringify(objectController.model.obj));
                      showLog("created");
                      callCustomOK(objectController,c.create);
                      resolve(objectController);
                    }else{
                      ajaxJSON(objectController.url,"post",JSON.stringify(objectController.model.obj),objectController).then(
                        function(data, textStatus,jqXHR){
                            showLog("created");
                            callCustomOK(objectController,c.create);
                            resolve(objectController);
                        },
                        function( jqXHR, textStatus, errorThrown ) {
                            callCustomERROR(objectController,c.create);
                            reject(objectController,errorThrown);
                        }
                      );
                    }

                }
            );
            return promise;
        };
        controller.prototype.read=function(){
            var objectController=this;
            var promise=new Promise(
                function(resolve,reject){
                    //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{ in the model
                    //{detect if url is a proper URL or an object (javascript object or JSON object as well)
                    var isObject=false;
                    if (typeof objectController.url=='object'){
                        isObject=true;
                    }else if (objectController.url.startsWith("{") || objectController.url.startsWith("[")){
                        try{
                            objectController.url=JSON.parse(objectController.url);
                            isObject=true;
                        }catch (err){
                            console.error("Controller '"+objectController.name+"'. The provider is not an URL neither an object ('"+objectController.url+"')");
                            isObject=false;
                        }
                    }
                    //end detect}
                    //retrieve provider data
                    if(isObject){
                        objectController.model.obj=objectController.url;
                        objectController.isReady=true;
                        paintToTemplate(objectController.name);
                        callCustomOK(objectController,c.read);
                        resolve(objectController);
                    }else{
                      var processed=lookupExpression(objectController.name,objectController.url,objectController.model.obj);
                      if (processed) objectController.url=processed.newText;
                      var url=objectController.url;
                      var storage;
                      if (url.startsWith("localStorage/")){
                        storage=localStorage;
                      } else if (url.startsWith("sessionStorage/")){
                        storage=sessionStorage;
                      }
                      if (storage){
                        let key=url.substring(url.indexOf('/')+1);
                        let objectType;
                        //if model is plural, it should be array
                        if (key.length>1 && key.substring(key.length-1).toLowerCase()==='s') objectType="[]"; else objectType="{}";
                        let value=storage.getItem(key);
                        if (!value){
                          value=objectType;
                          storage.setItem(key,value);
                        }
                        objectController.model.obj=JSON.parse(value);
                        objectController.isReady=true;
                        paintToTemplate(objectController.name);
                        callCustomOK(objectController,c.read);
                        resolve(objectController);
                      }else{
                        var aj=ajaxJSON(url,"get",undefined,objectController);
                        aj.then(
                          function(data, textStatus, jqXHR){
                            objectController.model.obj=data;
                            objectController.isReady=true;
                            paintToTemplate(objectController.name);
                            callCustomOK(objectController,c.read);
                            resolve(objectController);
                          },
                          function( jqXHR, textStatus, errorThrown ) {
                            callCustomERROR(objectController,c.read);
                            reject(objectController,errorThrown);
                        });
                      }
                    }
                }
            );
            return promise;
        };
        controller.prototype.update=function(){
            var objectController=this;
            var promise=new Promise(
                function(resolve,reject){
                  var url=objectController.url;
                  var storage;
                  if (url.startsWith("localStorage/")){
                    storage=localStorage;
                  } else if (url.startsWith("sessionStorage/")){
                    storage=sessionStorage;
                  }
                  //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
                  if (storage){
                    let key=url.substring(url.indexOf('/')+1);
                    storage.setItem(key,JSON.stringify(objectController.model.obj));
                    showLog("updated");
                    callCustomOK(objectController,c.update);
                    resolve(objectController);
                  }else{
                    ajaxJSON(objectController.url,"put",JSON.stringify(objectController.model.obj),objectController).then(
                        function(data, textStatus, jqXHR){
                            showLog("updated");
                            callCustomOK(objectController,c.update);
                            resolve(objectController);
                        },
                        function( jqXHR, textStatus, errorThrown ) {
                            callCustomERROR(objectController,c.update);
                            reject(objectController,errorThrown);
                        }
                    );
                  }

                }
            );
            return promise;
        };
        controller.prototype.delete=function(){
            var objectController=this;
            var promise=new Promise(
                function(resolve,reject){
                    //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
                    var url=objectController.url;
                    var storage;
                    if (url.startsWith("localStorage/")){
                      storage=localStorage;
                    } else if (url.startsWith("sessionStorage/")){
                      storage=sessionStorage;
                    }
                    //TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
                    if (storage){
                      let key=url.substring(url.indexOf('/')+1);
                      storage.removeItem(key);
                      showLog("deleted");
                      callCustomOK(objectController,c.delete);
                      resolve(objectController);
                    }else{
                      ajaxJSON(objectController.url,"delete",undefined,objectController).then(
                          function(data, textStatus, jqXHR){
                              showLog("deleted");
                              callCustomOK(objectController,c.delete);
                              resolve(objectController);
                          },
                          function( jqXHR, textStatus, errorThrown ) {
                              callCustomOK(objectController,c.delete);
                              reject(objectController,errorThrown);
                          }
                      );
                    }

                }
            );
            return promise;
        };


        controller.prototype.add=function(key,value){
          let controller=this;
          let model=this.model;
          let promise=new Promise(
              function(resolve,reject){
                try {
                  model.add(key,value);
                  resolve(controller);
                } catch (e) {
                  reject(controller,e);
                }
              }
          );
          return promise;
        };
        /**
         *Remove an element from the view. Change model and view BUT not in the server (You must call update() to save changes)
         *@param {HTMLElement} element. The element that called the function. Any element is accepted, but inside the row you want to remove.
         *@return {Promise}
         */
        controller.prototype.remove=function(element){
          let name=this.name;
          let controller=this;
          let model=this.model;
          let promise=new Promise(
              function(resolve,reject){
                if(!Array.isArray(model.obj)){
                  console.warn("Remove an object property is not a good idea");//remove a property is not a good idea. For instance: remove property type...bad
                  reject(controller);
                }
                let rowEl=null;
                let el=element;
                while(el && !rowEl){
                    let parent=el.parentElement;
                    if (parent.hasAttribute((c.data_model)) && parent.getAttribute(c.data_model)===name) rowEl=el;
                    el=parent;
                }
                if (!rowEl){
                  console.error("Error when removing element in template '"+name+"'. The child row was not found.");
                  reject(controller);
                }else{
                  let index=0;
                  for (let i = 0; i < rowEl.parentElement.children.length; i++) {
                    let child=rowEl.parentElement.children[i];
                    if (child===rowEl){
                      model.remove(index);
                      break;
                    }
                    index++;
                  }
                }
                resolve(controller);
              }
            );
            return promise;
        };
        controller.prototype.configure=function(urlOrObject,customMethods,options){
            this.url=urlOrObject;
            this.options=options;
            if(customMethods) this.customMethods=customMethods;
            if(options) this.options=options; else this.options='';
            this.isConfigured=true;
            if (this.options.indexOf("autorefresh")>-1){
              this.read();//call first direct to avoid delay
              setInterval(()=>this.read(),1000);
            }else{
              return this.read();
            }
        };
        controller.prototype._=function(){
            //TODO check if <input> binds are ed as well
            delete controllers[this.name];
            subscriptions.clean(this.name);
        };
        //return function
        if(controllers[name]){
            return controllers[name];
        }else{
            var cr=new controller(name);
            controllers[name]=cr;
            return cr;
        }
    };

    /*
    ███████ ███████  ██████ ██    ██ ██████  ██ ████████ ██    ██
    ██      ██      ██      ██    ██ ██   ██ ██    ██     ██  ██
    ███████ █████   ██      ██    ██ ██████  ██    ██      ████
         ██ ██      ██      ██    ██ ██   ██ ██    ██       ██
    ███████ ███████  ██████  ██████  ██   ██ ██    ██       ██
    */


    var _security=(function(){
        function _isAuthenticated(){
            if (headers[c.authorization]) return true;else return false;
        }
        function _setAuthenticated(token){
            headers[c.authorization]=token;
            document.cookie=c.authorization+"="+token;
        }
        function _getAuthenticated(){
            return headers[c.authorization];
        }
        function _removeAuthenticated(){
            delete headers[c.authorization];
            document.cookie = c.authorization + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
        return    {
            isAuthenticated:_isAuthenticated,
            setAuthenticated:_setAuthenticated,
            getAuthenticated:_getAuthenticated,
            removeAuthenticated:_removeAuthenticated
        }  ;
    })();

    var showLog=function(text){
        $("#"+c.layerLog).css("background-color","lime").text(text).slideDown().delay(2000).slideUp();
    };
    var showErrorLog=function(error){
        console.error(error);
        $("#"+c.layerLog).css("background-color","red").text(error).slideDown().delay(2000).slideUp();
    };
    var hideLog=function(){
        var $el=$("#"+c.layerLog);
        if($el.css("display")!="none") $el.slideUp();
    };

    /**
     * init is different than start. Init starts the ir object itself while start is called after page is loaded (and then renders the dynamic pages)
     */
    function init(){
        //process ad-hoc click events on <a> router links
        $(document).on("click","a["+c.data_event+"]",function(){
            temporaryCustomClick.router=this.getAttribute('href');
            temporaryCustomClick.func=this.getAttribute(c.data_event);
            temporaryCustomClick.new=true;
        });
        $(window).on("hashchange", processRoute);
        //Ajax can set request headers but not html files, every time a new tab is open  the list of headers are loaded from cookies
        insertHeaders();
    }

    /*
    ██ ███    ██ ██ ████████ ██  █████  ██      ██ ███████ ███████
    ██ ████   ██ ██    ██    ██ ██   ██ ██      ██    ███  ██
    ██ ██ ██  ██ ██    ██    ██ ███████ ██      ██   ███   █████
    ██ ██  ██ ██ ██    ██    ██ ██   ██ ██      ██  ███    ██
    ██ ██   ████ ██    ██    ██ ██   ██ ███████ ██ ███████ ███████
    */

    init();
    ////////////////////////////////////////////////////////////////////

    /*
    ██ ██████       ██████  ██████       ██ ███████  ██████ ████████
    ██ ██   ██     ██    ██ ██   ██      ██ ██      ██         ██
    ██ ██████      ██    ██ ██████       ██ █████   ██         ██
    ██ ██   ██     ██    ██ ██   ██ ██   ██ ██      ██         ██
    ██ ██   ██      ██████  ██████   █████  ███████  ██████    ██
    */

    return {
        start:function(){
            if ($(cssAttribute(c.data_container)).length===0) {console.warn("A tag with attribute "+c.data_container+" should be defined, to provide a default container when a page is loaded");} //if no default container, when refreshing a url with hash, a page is loaded but there is no target to load into.
            addCSS();
            createLayerLog();
            loadChildPages();//load pages requested from data-load containers
            processRoute();// load pages requested from the address bar
        },
        queryString:function(key){
            return queryString(key);
        },
        formData:function(form){
            return $(form).serializeArray();
        },
        /**
        * Generic ajax call.
        * Usage: ajax(url,method,payload).done(function(){//your function});
        */
        ajax:function(url,method,payload){
            return ajax(url,method,payload);
        },


        /**
        * Generic ajax call.
        * Usage: ajax(url,method,payload).done(function(){//your function});
        */
        ajaxForm:function(form){
            return $.ajax({
            headers:headers,
            url: form.action,
            cache:false,
            type: form.method,
            data: this.formData(form),
            dataType: '*',
            beforeSend: function(){hideLog();}
            })
            .always(function(data, textStatus, jqXHR_or_Error) {
            })
            .fail(function( jqXHR, textStatus, errorThrown) {
                processAjaxFailResponse(jqXHR, textStatus, errorThrown);
            });
        },
        load:function(url,container,callback){
            _load(url,container,callback);
        },
        onAvailable: function(variableName,scope,milliseconds,callback){
           onAvailable(variableName,scope,milliseconds,callback);
        },
        run:function(functionName,params,scope){
                run(functionName,params,scope);
        },
        session:function(){return session;},

        security:function(){return _security;},
        router:function(name){return router(name);},
        model:function(name){return controller(name).model;},
        controller:function(name){return controller(name);}
    };
}();

var $ir=iridium;//built-in shortcut
var ir=$ir;//built-in shortcut;

/*
███████ ████████  █████  ██████  ████████
██         ██    ██   ██ ██   ██    ██
███████    ██    ███████ ██████     ██
     ██    ██    ██   ██ ██   ██    ██
███████    ██    ██   ██ ██   ██    ██
*/


//IMPORTANT-Start after document is loaded
var iridiumNamespace=iridiumNamespace || "iridium";
var iridiumStartTag=iridiumStartTag || "{{";
var iridiumEndTag=iridiumEndTag || "}}";
$(document).ready(function(){
    iridium.start(iridiumNamespace,iridiumStartTag, iridiumEndTag);
});
