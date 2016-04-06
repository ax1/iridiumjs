if (console) console.info("iridium.js 0.4.2");

/*jshint -W083 */

//section que haga url
//attributes interesantes
//hidden, item e itempro, data-*  contenteditable="true"
//tags summary details
//TODO add prototype to router and view objects (as controller does)
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
		data_:"data-",
		create:"create",
		read:"read",
		update:"update",
		delete:"delete",
		remove:"remove" //TODO erase remove after delete keyword is checked
	};

	function cssAttribute(attr,value){
		if (!value && value!=='') {return "["+attr+"]"; }
		else {return "["+attr+"='"+value+"']";}
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
					var kv = data.split('=');
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
	* Look into an object,and find a deep property
	* Example: obj={a:1,b:{b1:0,b2:8}} and key=b.b2
	*/
	function getObjectProperty(object, key){
		if (!object) console.error("No object found when looking for key='"+key+"'");
		var data = key.split('.');
		if (data.length===1) return object[data];
		while(data.length>1){
			object = object[data.shift()];
			if (object===undefined) object={};
		}
		//return object[data.shift()] || "";
		return object[data.shift()] || "";
	}

	/**
	* Set a deep property value into an object
	* Note: if the property is not found, this method will create it
	* Example: obj={a:1,b:{b1:0,b2:8}} and key=b.b2 and value=10
	*/
	function setObjectProperty(object, key, value){
		var data = key.split('.');
		var k;
		var part;
		while(data.length>1){
			k=data.shift();
			part=object[k];
			if (part){
				object=part;
			}else {
				object[k]={};
				object=object[k];
			}
		}
		object[data.shift()] = value;
	}

	/**
	* Add required css style when page is loaded
	* This function is just to avoid having a css file
	*/
	function addCSS(){
		var style=
			"<style>"+
				"[data-model]{visibility:hidden}"+
				"[data-model][data-status]{visibility:visible}"+
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
	var count=0;
	function checkAndExecuteFunctionAfterViewsLoaded(url){
		delete pagesStillLoading[url];

		//(ALREADY LOADED WHEN CONFIGURE ROUTER->READ(either from controller().configure or from data-provider))
		$("["+c.data_model+"]:not(["+c.data_status+"])").each(function( ) {
			if (this.getAttribute(c.data_provider)) paintToTemplate(this.getAttribute(c.data_model));
		});
count++;
//		$("["+c.data_model+"]",":not["+c.data_status+"]").each(function( ) {
//			initializeTemplate($(this).attr(c.data_model),this);
//			$(this).attr(c.data_status,"inited");
//		});
		if($.isEmptyObject(pagesStillLoading)){
			if(funcToCallAfterViewLoaded) funcToCallAfterViewLoaded();
		}

	}

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
				if($(selector).length>1) console.warn("Container "+selector-+" is not unique (it should be most of the cases). The content of page "+url+" will be loaded into the first one");
			}

			var originalSelector=selector;
			testDuplicatedContainer(url,selector);
			if( $(selector).length===0){
				//no valid selector, find the best container for the page to be loaded
				selector="#"+selector;
				testDuplicatedContainer(url,selector);
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
			flagLoaded=false;
			console.log('loading '+url);
			if (url==='') {
				//default container so the content is already loaded, just execute the methods to render templates
				checkAndExecuteFunctionAfterViewsLoaded(url);
			}else{
				//any other selector, download page and then execute methods
				selector=calculateContainerSelector(url,selector);
				callback=callback || function(){};
				callbacks=function(){
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
				controllers[template.getAttribute(c.data_model)]._destroy();
			}
		}
		$(selector).empty();
	}

	//------------------------------------------------------------------
	//	TEMPLATE FUNCTIONS
	//------------------------------------------------------------------


	/**
	 * Given a expression retrieve value
	 * if key=key->current model, value from object
	 * if key=session:key->retrieve data from session
	 * if key=name:key-> retrieve key from other model.
	 * if key=$queryString-> retrieve the full querystring.
	 * if key=$queryString:key-> retrieve the querystring key.
	 */
	function processExpression(controllerName,key,object){

		function process(controllerName,key,object){
			//querystring is special, it can contain no keys
			if(key==="$queryString") return queryString();
			var index=key.indexOf(":");
			if(index<0){
				var pos=key.indexOf("(");
				if(pos>-1){
					return "ir.controller('"+controllerName+"')."+key;
				}else{
					return getObjectProperty(object, key);
				}
			}else{
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
					//extract data from existing model
					var modelName=prefix;
					if (!modelName) modelName='';
					//TODO add code when function instead of value
					return controllers[modelName].model.get(key);
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
			var data=text.substring(index1+tag1.length,index2);
			var key=data;
			var value=processExpression(controllerName,key,object);
			if(value===undefined) value="";
			var newText=text.substring(0,index1)+value+text.substring(index2+tag2.length);
			return{
				oldText:text,
				newText:newText,
				expression:data,
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
		function parseAttributes(isTemplateInited,templateName, el,jEl, object,arrayIndex){

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
				var realAttr=el[realAttrName];

				//----------------------------------------------------------
				//      if real attribute->set real values
				//----------------------------------------------------------
				if(jEl.attr(realAttrName)){
					//check if 'onevent' property
						//if true and templateInited do nothing
						//else add processed text
					var pos=realAttrName.indexOf("on");
					if (pos>-1 && isTemplateInited===true){
						//nothing
					}else{
						if(jEl.attr(realAttrName)!==expression) {jEl.attr(realAttrName,expression);}
					}
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
								console.debug('a');
								var val=$(this).val();
								controllers[templateName].model.set($(this).attr("data-bind"),val); //TODO ARF 13-10-15 check if event propagation is suitable (see $.on documentation). And check if it is better performance solution thant the corrent one snce every time a new input is created, it should update model , the tag itsself, etc. Mayby the curent solution is already the good one.
							});
						}
					}else{
						jEl.text(res.value);
					}
				}

			}

			function parseALLAttributes(isTemplateInited,templateName, el,jEl, object,arrayIndex){
				//initialize the first time
				if(!isTemplateInited){
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
				}
				//lookup in ATTRIBUTES
				for(var r=0;r<el.attributes.length;r++){
					parseAttribute(el.attributes[r]);
				}
			}


			parseALLAttributes(isTemplateInited,templateName, el,jEl, object,arrayIndex);
		}

		/**
		 * parse {{}} in element contents
		 */
		function parseContent(isTemplateInited,templateName, el,jEl, object){
			if(!isTemplateInited){
				//if not inited create the <span> nodes
				var nodes=el.childNodes;
				for (var r=0;r<nodes.length;r++){
					var node=nodes[r];
					//IF TEXT
					if (node.nodeType==3){
						if (node.data.indexOf(tag1)===-1) continue;
						var res=lookupExpression(templateName,node.data,object);
						if(res && res.found){
							var node1=document.createTextNode(res.oldText.substring(0,res.index1));
							var node2=document.createElement("span");node2.setAttribute("data-value",tag1+res.expression+tag2);node2.data=res.value;
							var node3=document.createTextNode(res.oldText.substring(res.index2));
							node.parentNode.insertBefore(node1,node);node.parentNode.insertBefore(node2,node);node.parentNode.insertBefore(node3,node);
							node.parentNode.removeChild(node);
							r=0;//reset loop
						}
					}//END IF TEXT
				}
			}
		}

		/**
		 * parse {{}} in child elements
		 */
		function parseChildren(isTemplateInited,templateName, el,jEl, object){
			//lookup in CHILD ELEMENTS
			if(el.children.length>0){
				for(var s=0;s<el.children.length;s++){
					var elChild=el.children[s];
					if(elChild.attributes[c.data_model]) {
						paintToTemplate(elChild.attributes[c.data_model]); //if other template is found, bypass (it will be managed by another controller)
					}else {
						paintNodes(isTemplateInited,templateName,elChild,$(elChild),object);
					}
				}
			}
		}

		/**
		 * if data-model='details' everything is ok
		 * if data-model='details_{{index}}' the template name should be changed and attached to controller (if exists)
		 */
		function checkDynamicTemplateName(templateName, elTemplate,object){
			//check-data-model
			var model=templateName;
			var provider=elTemplate.getAttribute(c.data_provider);
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
				if(controllers[model]) throw (namespace+": controller "+model+":"+provider+" is an existing object. Either remove it or just ovewrite it");
				//controllers[model]=controller(model);
			}
			//if changed, load provider async(ajax), and don't paint until the data is downloaded
			// if(res1 || res2){
			// 	//controllers[model].configure(provider);
			// 	return true;
			// } else {
			// 	return false;
			// }
			return model;
		}

		/**
		 * If controller definition is in template tag, it must be configured first;
		 */
		function checkIfControllerIsConfiguredAndReady(templateName,elTemplate){
			var model=templateName;
			var provider=elTemplate.getAttribute(c.data_provider);
			if(!provider){//if not configured in html mode, it must be configured in javascript mode
				if (!controllers[model]) {
					console.warning( "there is no controller for "+templateName+". Check if ["+c.data_provider+"] or ir.controller(name).configure(url) exists");
					return false;
				}else return true;
			}
			if(provider && !controllers[model]){
				var cr=controller(model);
				controllers[model]=cr;
				cr.configure(provider);
				return false;
			}else{
				if (controllers[model].isReady) return true;
				else return false;
			}
		}

		/**
		 * Based on the template syntax, data is rendered.
		 * Note: the template syntax is not replaced, new attributes are created in elements, to keep thant syntax while replacing with real data
		 * @param templateName the name of the template that is currently processed
		 */
		function paintToTemplate(templateName){
			//alert(templateName);
			var selector=cssAttribute(c.data_model,templateName);
			var jTemplate=$(selector);
			if (jTemplate.length<=0) console.warn("template '"+selector+"' was not found. If you are trying to render data to HTML (templates), this is an ERROR. On the other side, if you just want to perform REST calls and process the data with javascript, this is an INFO messsage.");
			var elTemplate=jTemplate[0];
			if(!elTemplate) return;
			var isTemplateInited=false;
			var newTemplate=checkDynamicTemplateName(templateName, elTemplate,object);
			if(templateName!==newTemplate){
				paintToTemplate(newTemplate);
				return;
			}
			// if(checkDynamicTemplateName(templateName, elTemplate,object)) {
			// 	return; //dynamic template, the controller has been configured and it will call this method later, so exit.
			// }
			if(checkIfControllerIsConfiguredAndReady(templateName,elTemplate)===false)  {
				return; //wait for configuration process finished
			}
			var object=controllers[templateName].model.obj;
			if(jTemplate.attr(c.data_status)){isTemplateInited=true;}
			//if(!(el instanceof HTMLElement)) el=$(el)[0];//TODO check if this line is still a valid functionality
			console.debug("initializing template '" +templateName+"'");
			//paint nodes
			paintNodes(isTemplateInited,templateName,elTemplate,jTemplate,object);

			//if template was not inited yet->all processed->mark as inited
			if(isTemplateInited===false){
				jTemplate.attr(c.data_status,"inited");
			}
		}

		/**
		 * Check type of data (array, object) and process nodes.
		 * Note: the template syntax is not replaced, new attributes are created in elements, to keep thant syntax while replacing with real data
		 * @param isTemplateInited
		 * @param templateName the name of the template that is currently processed
		 * @param el the DOM element to be processed, el can be a dom object OR a css selector
		 * @param jEl the $(el), passed as param just for performance purposes
		 * @param object the data from the model to be inserted into the DOM
		 * @param el the DOM element to be processed, el can be a dom object or a css selector
		 */
		function paintNodes(isTemplateInited,templateName,el,jEl,object){
			if(!(el instanceof HTMLElement)){//TODO review this if (maybe deprecated)
				 el=$(el)[0];
				jEl=$(el);
			}
			if(el.attributes[c.data_skeleton]) return;//if skeleton, do nothing
			if(object instanceof Array && el.hasAttribute(c.data_model)){
				var array=object;
				//if template not processed, copy all child nodes into a hidden container
				if (isTemplateInited===false){
					//create skeleton
					var elSkeleton=document.createElement("div");
					elSkeleton.style.display="none";
					elSkeleton.setAttribute(c.data_skeleton,"");
					for (var r=0;r<el.children.length;r++){elSkeleton.appendChild(el.children[r]);}
					//create the list elements
					var skeleton=elSkeleton.innerHTML;
					var text="";
					array.forEach(function (item, index,arr){
						var newText=skeleton.replace(/\{\{0}}/g,"{{"+index+"}}");
						newText=newText.replace(/\{\{0\./g,"{{"+index+".");
						text=text+newText;
					});
					el.innerHTML=text;
					el.appendChild(elSkeleton);
					parseChildren(isTemplateInited,templateName, el,jEl, object);
					//the following code has better performance but it would be difficult to change array index for all the {{}} in properties and child nodes
					// array.forEach(function (item, index,arr){
					// 	var elClone=elSkeleton.cloneNode(true);
					// 	var children=elClone.children;
					// 	for (var i = 0; i < children.length; i++) {
					// 		var elChild=children[i];
					// 		var jElChild=$(elChild);
					// 		el.appendChild(elChild);
					// 		parseAttributes(isTemplateInited,templateName,elChild,jElChild,object,i);
					// 		parseContent(isTemplateInited,templateName,elChild,jElChild,object,i);
					// 		parseChildren(isTemplateInited,templateName,elChild,jElChild,object,i);
					// 	}
					// });
				}
			}else{
				parseAttributes(isTemplateInited,templateName, el,jEl, object);
				parseContent(isTemplateInited,templateName, el,jEl, object);
				parseChildren(isTemplateInited,templateName, el,jEl, object);
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

	//------------------------------------------------------------------
	// SESSION
	//------------------------------------------------------------------
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

	//------------------------------------------------------------------
	// ROUTERS
	//------------------------------------------------------------------
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




	var firstTime=true;//check if page is refreshed or not.
	var funcToCallAfterViewLoaded;

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
			console.log("processing router  '"+location.hash+"'");
			funcToCallAfterViewLoaded=undefined;
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
			//TODO resolver el problema de cuando se refresca la pagina
			//tiene que buscar el target(container) porque si no se carga por defecto en el body (y se perdería el resto)
			//JOrigin tiene los targets, poner ese target y no target=id que está mas abajo, si no hay target se pone target=id
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




	//------------------------------------------------------------------
	//	CONTROLLERS
	//------------------------------------------------------------------
	var model=function(name){

		var model={
			name:name,
			obj:{},
			get:function(key){return getObjectProperty(this.obj,key);},
			set:function(key,value){
				//TODO:SECURITY, PREVENT CODE INJECTION
				///value=encodeURI(value);
				setObjectProperty(this.obj,key,value);
				paintToTemplate(this.name);
				//$("["+c.data_model+"='"+name+"']").find("["+c.data_value+"='"+key+"']").html(value);
			}
		};
		return model;
	};

	var controller=function(name){

		function controller(name2){
			this.name=name;
			this.url=undefined;
			this.model=model(name);
			this.template=cssAttribute(c.data_model,this.name);
			this.isReady=false;
			this.customMethods={};
		}

		function callCustomOK(objectController,method){
			if(objectController.customMethods[method] && objectController.customMethods[method][0]) {
				objectController.customMethods[method][0](objectController);
			}
		}

		function callCustomERROR(controller,method){
			if(objectController.customMethods[method] && objectController.customMethods[method][1]){
				objectController.customMethods[method][1](objectController);
			}

		}

		controller.prototype.create=function(){
			var objectController=this;
			var promise=new Promise(
				function(resolve,reject){
					//TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
						ajaxJSON(objectController.url,"post",JSON.stringify(objectController.model.obj),objectController).then(
						function(data, textStatus, jqXHR){
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
			);
			return promise;
		};
		controller.prototype.read=function(){
			var objectController=this;
			var promise=new Promise(
				function(resolve,reject){
					//TODO:SECURITY, PREVENT CODE INJECTION by escaping {{ in the model
					if(typeof objectController.url=='object'){
						objectController.model.obj=objectController.url;
						paintToTemplate(objectController.name);
						callCustomOK(objectController,c.read);
						resolve(objectController);
					}else{
						var url=objectController.url;
						var processed=lookupExpression(objectController.name,objectController.url,objectController.model.obj);
						if (processed) url=processed.newText;
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
			);
			return promise;
		};
		controller.prototype.update=function(){
			var objectController=this;
			var promise=new Promise(
				function(resolve,reject){
					//TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
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
			);
			return promise;
		};
		controller.prototype.delete=function(){
			var objectController=this;
			var promise=new Promise(
				function(resolve,reject){
					//TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
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
			);
			return promise;
		};
		/**
		*@deprecated
		* //TODO remove this method when delete is checked
		*/
		controller.prototype.remove=function(){
			var objectController=this;
			var promise=new Promise(
				function(resolve,reject){
					//TODO:SECURITY, PREVENT CODE INJECTION by escaping {{
					ajaxJSON(objectController.url,"delete",undefined,objectController).then(
						function(data, textStatus, jqXHR){
							showLog("deleted");
							callCustomOK(objectController,c.remove);
							resolve(objectController);
						},
						function( jqXHR, textStatus, errorThrown ) {
							callCustomOK(objectController,c.remove);
							reject(objectController,errorThrown);
						}
					);
				}
			);
			return promise;
		};
		controller.prototype.configure=function(urlOrObject,customMethods){
			//set params
			this.url=urlOrObject;
			if(customMethods){
				this.customMethods=customMethods;
			}
			//retrieve data
			return this.read();
		};
		controller.prototype._destroy=function(){
			//TODO check if <input> binds are destroyed as well
			delete controllers[this.name];
		};

		//return function
		if(controllers[name]){
			return 	controllers[name];
		}else{
			var cr=new controller(name);
			controllers[name]=cr;
			return cr;
		}
	};



	//------------------------------------------------------------------
	//	SECURITY
	//------------------------------------------------------------------

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
		return	{
			isAuthenticated:_isAuthenticated,
			setAuthenticated:_setAuthenticated,
			getAuthenticated:_getAuthenticated,
			removeAuthenticated:_removeAuthenticated,
		}  ;
	})();

	showLog=function(text){
		$("#"+c.layerLog).css("background-color","lime").text(text).slideDown();
	};
	showErrorLog=function(error){
		console.error(error);
		$("#"+c.layerLog).css("background-color","red").text(error).slideDown();
	};
	hideLog=function(){
		var $el=$("#"+c.layerLog);
		if($el.css("display")!="none") $el.slideUp();
	};
	/**
	 * init is different than start. Init starts the r object itself while start is called after page is loaded (and then renders the dynamic pages)
	 */
	function init(){
		$(window).on("hashchange", processRoute);
		//Ajax can set request headers but not html files, every time a new tab is open  the list of headers are loaded from cookies
		insertHeaders();
	}

	//initialize
	init();
	////////////////////////////////////////////////////////////////////


	return {
		start:function(){
			if ($(cssAttribute(c.data_container)).length===0) {console.warn("A tag with attribute "+c.data_container+" should be defined, to provide a default container when a page is loaded");} //if no default container, when refreshing a url with hash, a page is loaded but there is no target to load into.
			addCSS();
			createLayerLog();
			processRoute();
		},
		queryString:function(key){
			return queryString(key);
		},
		getFormData:function(form){
			return $(form).serializeArray();
			/*
			this code was replaced by jquery equivalent
			var data={};
			for (var r=0;r<form.elements.length;r++){
			    var name=form[r].name;
			    if (!name) name="param_"+r;
			    data[name]=form[r].value;
			}
			return data;*/
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
			data: this.getFormData(form),
			dataType: '*',
			beforeSend: function(){hideLog();}
			})
			.always(function(data, textStatus, jqXHR_or_Error) {
			})
			.fail(function( jqXHR, textStatus, errorThrown) {
				processAjaxFailResponse(jqXHR, textStatus, errorThrown);
			});
		},
		load:function(url,selector,callback){
			_load(url,selector,callback);
		},
		session:function(){return session;},

		security:function(){return _security;},

//		view:function(name){return view(name);}
//		,
		router:function(name){return router(name);},
		model:function(name){return controller(name).model;},
		controller:function(name){return controller(name);}
	};
}();

var ir=iridium;//built-in shortcut
var $ir=iridium;//built-in shortcut;


//IMPORTANT-Start after document is loaded
var iridiumNamespace=iridiumNamespace || "iridium";
var iridiumStartTag=iridiumStartTag || "{{";
var iridiumEndTag=iridiumEndTag || "}}";
$(document).ready(function(){
	iridium.start(iridiumNamespace,iridiumStartTag, iridiumEndTag);
});
