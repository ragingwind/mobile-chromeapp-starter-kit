

  Polymer = {
    Settings: (function() {
      // NOTE: Users must currently opt into using ShadowDOM. They do so by doing:
      // Polymer = {dom: 'shadow'};
      // TODO(sorvell): Decide if this should be auto-use when available.
      // TODO(sorvell): if SD is auto-use, then the flag above should be something
      // like: Polymer = {dom: 'shady'}
      
      // via Polymer object
      var user = window.Polymer || {};

      // via url
      location.search.slice(1).split('&').forEach(function(o) {
        o = o.split('=');
        o[0] && (user[o[0]] = o[1] || true);
      });

      var wantShadow = (user.dom === 'shadow');
      var hasShadow = Boolean(Element.prototype.createShadowRoot);
      var nativeShadow = hasShadow && !window.ShadowDOMPolyfill;
      var useShadow = wantShadow && hasShadow;

      var hasNativeImports = Boolean('import' in document.createElement('link'));
      var useNativeImports = hasNativeImports;

      var useNativeCustomElements = (!window.CustomElements ||
        window.CustomElements.useNative);

      return {
        wantShadow: wantShadow,
        hasShadow: hasShadow,
        nativeShadow: nativeShadow,
        useShadow: useShadow,
        useNativeShadow: useShadow && nativeShadow,
        useNativeImports: useNativeImports,
        useNativeCustomElements: useNativeCustomElements
      };
    })()
  };


;

  (function() {

    // until ES6 modules become standard, we follow Occam and simply stake out
    // a global namespace

    // Polymer is a Function, but of course this is also an Object, so we
    // hang various other objects off of Polymer.*

    var userPolymer = window.Polymer;

    window.Polymer = function(prototype) {
      var ctor = desugar(prototype);
      // Polymer.Base is now chained to ctor.prototype, and for IE10 compat
      // this may have resulted in a new prototype being created
      prototype = ctor.prototype;
      // native Custom Elements treats 'undefined' extends property
      // as valued, the property must not exist to be ignored
      var options = {
        prototype: prototype
      };
      if (prototype.extends) {
        options.extends = prototype.extends;
      }
      Polymer.telemetry._registrate(prototype);
      document.registerElement(prototype.is, options);
      return ctor;
    };

    var desugar = function(prototype) {
      prototype = Polymer.Base.chainObject(prototype, Polymer.Base);
      prototype.registerCallback();
      return prototype.constructor;
    };

    window.Polymer = Polymer;

    if (userPolymer) {
      for (var i in userPolymer) {
        Polymer[i] = userPolymer[i];
      }
    }

    Polymer.Class = desugar;

  })();

  /*
  // Raw usage
  [ctor =] Polymer.Class(prototype);
  document.registerElement(name, ctor);

  // Simplified usage
  [ctor = ] Polymer(prototype);
  */

  // telemetry: statistics, logging, and debug

  Polymer.telemetry = {
    registrations: [],
    _regLog: function(prototype) {
      console.log('[' + prototype.is + ']: registered')
    },
    _registrate: function(prototype) {
      this.registrations.push(prototype);
      Polymer.log && this._regLog(prototype);
    },
    dumpRegistrations: function() {
      this.registrations.forEach(this._regLog);
    }
  };


;

  // a tiny bit of sugar for `document.currentScript.ownerDocument`
  Object.defineProperty(window, 'currentImport', {
    enumerable: true,
    configurable: true,
    get: function() {
      return (document._currentScript || document.currentScript).ownerDocument;
    }
  });


;

  Polymer.Base = {

    // pluggable features
    // `this` context is a prototype, not an instance
    _addFeature: function(feature) {
      this.extend(this, feature);
    },

    // `this` context is a prototype, not an instance
    registerCallback: function() {
      this._registerFeatures();  // abstract
      this._doBehavior('registered'); // abstract
    },

    createdCallback: function() {
      Polymer.telemetry.instanceCount++;
      this.root = this;
      this._doBehavior('created'); // abstract
      this._initFeatures(); // abstract
    },

    // reserved for canonical behavior
    attachedCallback: function() {
      this.isAttached = true;
      this._doBehavior('attached'); // abstract
    },

    // reserved for canonical behavior
    detachedCallback: function() {
      this.isAttached = false;
      this._doBehavior('detached'); // abstract
    },

    // reserved for canonical behavior
    attributeChangedCallback: function(name) {
      this.setAttributeToProperty(this, name); // abstract
      this._doBehavior('attributeChanged', arguments); // abstract
    },

    // copy own properties from `api` to `prototype`
    extend: function(prototype, api) {
      if (prototype && api) {
        Object.getOwnPropertyNames(api).forEach(function(n) {
          this.copyOwnProperty(n, api, prototype);
        }, this);
      }
      return prototype || api;
    },

    copyOwnProperty: function(name, source, target) {
      var pd = Object.getOwnPropertyDescriptor(source, name);
      if (pd) {
        Object.defineProperty(target, name, pd);
      }
    },

    _log: console.log.apply.bind(console.log, console),
    _warn: console.warn.apply.bind(console.warn, console),
    _error: console.error.apply.bind(console.error, console),
    _logf: function(/* args*/) {
      return this._logPrefix.concat([this.is]).concat(Array.prototype.slice.call(arguments, 0));
    }

  };

  Polymer.Base._logPrefix = (function(){
    var color = window.chrome || (/firefox/i.test(navigator.userAgent));
    return color ? ['%c[%s::%s]:', 'font-weight: bold; background-color:#EEEE00;'] : ['[%s::%s]:'];
  })();

  Polymer.Base.chainObject = function(object, inherited) {
    if (object && inherited && object !== inherited) {
      if (!Object.__proto__) {
        object = Polymer.Base.extend(Object.create(inherited), object);
      }
      object.__proto__ = inherited;
    }
    return object;
  };

  Polymer.Base = Polymer.Base.chainObject(Polymer.Base, HTMLElement.prototype);

  // TODO(sjmiles): ad hoc telemetry
  Polymer.telemetry.instanceCount = 0;


;

(function() {

  var modules = {};

  var DomModule = function() {
    return document.createElement('dom-module');
  };

  DomModule.prototype = Object.create(HTMLElement.prototype);

  DomModule.prototype.constructor = DomModule;

  DomModule.prototype.createdCallback = function() {
    var id = this.id || this.getAttribute('name') || this.getAttribute('is');
    if (id) {
      this.id = id;
      modules[id] = this;
    }
  };

  DomModule.prototype.import = function(id, slctr) {
    var m = modules[id];
    if (!m) {
      // If polyfilling, a script can run before a dom-module element
      // is upgraded. We force the containing document to upgrade
      // and try again to workaround this polyfill limitation.
      forceDocumentUpgrade();
      m = modules[id];
    }
    if (m && slctr) {
      m = m.querySelector(slctr);
    }
    return m;
  };

  // NOTE: HTMLImports polyfill does not
  // block scripts on upgrading elements. However, we want to ensure that
  // any dom-module in the tree is available prior to a subsequent script
  // processing.
  // Therefore, we force any dom-modules in the tree to upgrade when dom-module
  // is registered by temporarily setting CE polyfill to crawl the entire
  // imports tree. (Note: this should only upgrade any imports that have been
  // loaded by this point. In addition the HTMLImports polyfill should be
  // changed to upgrade elements prior to running any scripts.)
  var cePolyfill = window.CustomElements && !CustomElements.useNative;
  if (cePolyfill) {
    var ready = CustomElements.ready;
    CustomElements.ready = true;
  }
  document.registerElement('dom-module', DomModule);
  if (cePolyfill) {
    CustomElements.ready = ready;
  }

  function forceDocumentUpgrade() {
    if (cePolyfill) {
      var script = document._currentScript || document.currentScript;
      if (script) {
        CustomElements.upgradeAll(script.ownerDocument);
      }
    }
  }

})();


;

  Polymer.Base._addFeature({

    _prepIs: function() {
      if (!this.is) {
        var module =
          (document._currentScript || document.currentScript).parentNode;
        if (module.localName === 'dom-module') {
          var id = module.id || module.getAttribute('name')
            || module.getAttribute('is')
          this.is = id;
        }
      }
    }

  });


;

  /**
   * Automatically extend using objects referenced in `behaviors` array.
   *
   *     someBehaviorObject = {
   *       accessors: {
   *        value: {type: Number, observer: '_numberChanged'}
   *       },
   *       observers: [
   *         // ...
   *       ],
   *       ready: function() {
   *         // called before prototoype's ready
   *       },
   *       _numberChanged: function() {}
   *     };
   *
   *     Polymer({
   *
   *       behaviors: [
   *         someBehaviorObject
   *       ]
   *
   *       ...
   *
   *     });
   *
   * @class base feature: behaviors
   */

  Polymer.Base._addFeature({

    behaviors: [],

    _prepBehaviors: function() {
      if (this.behaviors.length) {
        this.behaviors = this._flattenBehaviorsList(this.behaviors);
      }
      this._prepAllBehaviors();
    },

    _flattenBehaviorsList: function(behaviors) {
      var flat = [];
      behaviors.forEach(function(b) {
        if (b instanceof Array) {
          flat = flat.concat(b);
        } else {
          flat.push(b);
        }
      }, this);
      return flat;
    },

    _prepAllBehaviors: function() {
      // filter so other iterators don't need null check
      this.behaviors = this.behaviors.filter(function(b) {
        if (b) {
          this._mixinBehavior(b);
          this._prepBehavior(b);
          return true;
        }
        this._warn(this._logf('_prepAllBehaviors', 'behavior is null, check for missing or 404 import'));
      }, this);
      this._prepBehavior(this);
    },

    _mixinBehavior: function(b) {
      Object.getOwnPropertyNames(b).forEach(function(n) {
        switch (n) {
          case 'registered':
          case 'properties':
          case 'observers':
          case 'listeners':
          case 'keyPresses':
          case 'hostAttributes':
          case 'created':
          case 'attached':
          case 'detached':
          case 'attributeChanged':
          case 'configure':
          case 'ready':
            break;
          default:
            if (!this.hasOwnProperty(n)) {
              this.copyOwnProperty(n, b, this);
            }
            break;
        }
      }, this);
    },

    _doBehavior: function(name, args) {
      this.behaviors.forEach(function(b) {
        this._invokeBehavior(b, name, args);
      }, this);
      this._invokeBehavior(this, name, args);
    },

    _invokeBehavior: function(b, name, args) {
      var fn = b[name];
      if (fn) {
        fn.apply(this, args || Polymer.nar);
      }
    },

    _marshalBehaviors: function() {
      this.behaviors.forEach(function(b) {
        this._marshalBehavior(b);
      }, this);
      this._marshalBehavior(this);
    }

  });


;

  /**
   * Support `extends` property (for type-extension only).
   *
   * If the mixin is String-valued, the corresponding Polymer module
   * is mixed in.
   *
   *     Polymer({
   *       is: 'pro-input',
   *       extends: 'input',
   *       ...
   *     });
   *
   * Type-extension objects are created using `is` notation in HTML, or via
   * the secondary argument to `document.createElement` (the type-extension
   * rules are part of the Custom Elements specification, not something
   * created by Polymer).
   *
   * Example:
   *
   *     <!-- right: creates a pro-input element -->
   *     <input is="pro-input">
   *
   *     <!-- wrong: creates an unknown element -->
   *     <pro-input>
   *
   *     <script>
   *        // right: creates a pro-input element
   *        var elt = document.createElement('input', 'pro-input');
   *
   *        // wrong: creates an unknown element
   *        var elt = document.createElement('pro-input');
   *     <\script>
   *
   *   @class base feature: extends
   */

  Polymer.Base._addFeature({

    _prepExtends: function() {
      if (this.extends) {
        this.__proto__ = this._getExtendedPrototype(this.extends);
      }
    },

    _getExtendedPrototype: function(tag) {
      return this._getExtendedNativePrototype(tag);
    },

    _nativePrototypes: {}, // static

    _getExtendedNativePrototype: function(tag) {
      var p = this._nativePrototypes[tag];
      if (!p) {
        var np = this.getNativePrototype(tag);
        p = this.extend(Object.create(np), Polymer.Base);
        this._nativePrototypes[tag] = p;
      }
      return p;
    },

    getNativePrototype: function(tag) {
      // TODO(sjmiles): sad necessity
      return Object.getPrototypeOf(document.createElement(tag));
    }

  });


;

  /**
   * Generates a boilerplate constructor.
   * 
   *     XFoo = Polymer({
   *       is: 'x-foo'
   *     });
   *     ASSERT(new XFoo() instanceof XFoo);
   *  
   * You can supply a custom constructor on the prototype. But remember that 
   * this constructor will only run if invoked **manually**. Elements created
   * via `document.createElement` or from HTML _will not invoke this method_.
   * 
   * Instead, we reuse the concept of `constructor` for a factory method which 
   * can take arguments. 
   * 
   *     MyFoo = Polymer({
   *       is: 'my-foo',
   *       constructor: function(foo) {
   *         this.foo = foo;
   *       }
   *       ...
   *     });
   * 
   * @class base feature: constructor
   */

  Polymer.Base._addFeature({

    // registration-time

    _prepConstructor: function() {
      // support both possible `createElement` signatures
      this._factoryArgs = this.extends ? [this.extends, this.is] : [this.is];
      // thunk the constructor to delegate allocation to `createElement`
      var ctor = function() { 
        return this._factory(arguments); 
      };
      if (this.hasOwnProperty('extends')) {
        ctor.extends = this.extends; 
      }
      // ensure constructor is set. The `constructor` property is
      // not writable on Safari; note: Chrome requires the property
      // to be configurable.
      Object.defineProperty(this, 'constructor', {value: ctor, 
        writable: true, configurable: true});
      ctor.prototype = this;
    },

    _factory: function(args) {
      var elt = document.createElement.apply(document, this._factoryArgs);
      if (this.factoryImpl) {
        this.factoryImpl.apply(elt, args);
      }
      return elt;
    }

  });


;

  /**
   * Define property metadata.
   *
   *     properties: {
   *       <property>: <Type || Object>,
   *       ...
   *     }
   *
   * Example:
   *
   *     properties: {
   *       // `foo` property can be assigned via attribute, will be deserialized to
   *       // the specified data-type. All `properties` properties have this behavior.
   *       foo: String,
   *
   *       // `bar` property has additional behavior specifiers.
   *       //   type: as above, type for (de-)serialization
   *       //   notify: true to send a signal when a value is set to this property
   *       //   reflectToAttribute: true to serialize the property to an attribute
   *       //   readOnly: if true, the property has no setter
   *       bar: {
   *         type: Boolean,
   *         notify: true
   *       }
   *     }
   *
   * By itself the properties feature doesn't do anything but provide property
   * information. Other features use this information to control behavior.
   *
   * The `type` information is used by the `attributes` feature to convert
   * String values in attributes to typed properties. The `bind` feature uses
   * property information to control property access.
   *
   * Marking a property as `notify` causes a change in the property to
   * fire a non-bubbling event called `<property>-changed`. Elements that
   * have enabled two-way binding to the property use this event to
   * observe changes.
   *
   * `readOnly` properties have a getter, but no setter. To set a read-only
   * property, use the private setter method `_set_<property>(value)`.
   *
   * @class base feature: properties
   */

  // null object
  Polymer.nob = Object.create(null);

  Polymer.Base._addFeature({

    properties: {
    },

    getPropertyInfo: function(property) {
      var info = this._getPropertyInfo(property, this.properties);
      if (!info) {
        this.behaviors.some(function(b) {
          return info = this._getPropertyInfo(property, b.properties);
        }, this);
      }
      return info || Polymer.nob;
    },

    _getPropertyInfo: function(property, properties) {
      var p = properties && properties[property];
      if (typeof(p) === 'function') {
        p = properties[property] = {
          type: p
        };
      }
      // Let users determine whether property was defined without null check
      if (p) {
        p.defined = true;
      }
      return p;
    }

  });


;

  Polymer.CaseMap = {

    _caseMap: {},

    dashToCamelCase: function(dash) {
      var mapped = Polymer.CaseMap._caseMap[dash];
      if (mapped) {
        return mapped;
      }
      // TODO(sjmiles): is rejection test actually helping perf?
      if (dash.indexOf('-') < 0) {
        return Polymer.CaseMap._caseMap[dash] = dash;
      }
      return Polymer.CaseMap._caseMap[dash] = dash.replace(/-([a-z])/g, 
        function(m) {
          return m[1].toUpperCase(); 
        }
      );
    },

    camelToDashCase: function(camel) {
      var mapped = Polymer.CaseMap._caseMap[camel];
      if (mapped) {
        return mapped;
      }
      return Polymer.CaseMap._caseMap[camel] = camel.replace(/([a-z][A-Z])/g, 
        function (g) { 
          return g[0] + '-' + g[1].toLowerCase() 
        }
      );
    }

  };


;

  /**
   * Support for `hostAttributes` property.
   *
   *     hostAttributes: 'block vertical layout'
   *
   * `hostAttributes` is a space-delimited string of boolean attribute names to
   * set true on each instance.
   *
   * Support for mapping attributes to properties.
   *
   * Properties that are configured in `properties` with a type are mapped
   * to attributes.
   *
   * A value set in an attribute is deserialized into the specified
   * data-type and stored into the matching property.
   *
   * Example:
   *
   *     properties: {
   *       // values set to index attribute are converted to Number and propagated
   *       // to index property
   *       index: Number,
   *       // values set to label attribute are propagated to index property
   *       label: String
   *     }
   *
   * Types supported for deserialization:
   *
   * - Number
   * - Boolean
   * - String
   * - Object (JSON)
   * - Array (JSON)
   * - Date
   *
   * This feature implements `attributeChanged` to support automatic
   * propagation of attribute values at run-time. If you override
   * `attributeChanged` be sure to call this base class method
   * if you also want the standard behavior.
   *
   * @class base feature: attributes
   */

  Polymer.Base._addFeature({

    _marshalAttributes: function() {
      this._takeAttributes();
    },

    _installHostAttributes: function(attributes) {
      if (attributes) {
        this._applyAttributes(this, attributes);
      }
    },

    /* apply attributes to node but avoid overriding existing values */
    _applyAttributes: function(node, attr$) {
      for (var n in attr$) {
        // NOTE: never allow 'class' to be set in hostAttributes
        // since shimming classes would make it work 
        // inconsisently under native SD
        if (!this.hasAttribute(n) && (n !== 'class')) {
          this.serializeValueToAttribute(attr$[n], n, this);
        }
      }
    },

    _takeAttributes: function() {
      this._takeAttributesToModel(this);
    },

    _takeAttributesToModel: function(model) {
      for (var i=0, l=this.attributes.length; i<l; i++) {
        this.setAttributeToProperty(model, this.attributes[i].name);
      }
    },

    setAttributeToProperty: function(model, attrName) {
      // Don't deserialize back to property if currently reflecting
      if (!this._serializing) {
        var propName = Polymer.CaseMap.dashToCamelCase(attrName);
        var info = this.getPropertyInfo(propName);
        if (info.defined ||
          (this._propertyEffects && this._propertyEffects[propName])) {
          var val = this.getAttribute(attrName);
          model[propName] = this.deserialize(val, info.type);
        }
      }
    },

    _serializing: false,
    reflectPropertyToAttribute: function(name) {
      this._serializing = true;
      this.serializeValueToAttribute(this[name],
        Polymer.CaseMap.camelToDashCase(name));
      this._serializing = false;
    },

    serializeValueToAttribute: function(value, attribute, node) {
      var str = this.serialize(value);
      (node || this)
        [str === undefined ? 'removeAttribute' : 'setAttribute']
          (attribute, str);
    },

    deserialize: function(value, type) {
      switch (type) {
        case Number:
          value = Number(value);
          break;

        case Boolean:
          value = (value !== null);
          break;

        case Object:
          try {
            value = JSON.parse(value);
          } catch(x) {
            // allow non-JSON literals like Strings and Numbers
          }
          break;

        case Array:
          try {
            value = JSON.parse(value);
          } catch(x) {
            value = null;
            console.warn('Polymer::Attributes: couldn`t decode Array as JSON');
          }
          break;

        case Date:
          value = new Date(value);
          break;

        case String:
        default:
          break;
      }
      return value;
    },

    serialize: function(value) {
      switch (typeof value) {
        case 'boolean':
          return value ? '' : undefined;

        case 'object':
          if (value instanceof Date) {
            return value;
          } else if (value) {
            try {
              return JSON.stringify(value);
            } catch(x) {
              return '';
            }
          }

        default:
          return value != null ? value : undefined;
      }
    }

  });


;

  Polymer.Base._addFeature({

    _setupDebouncers: function() {
      this._debouncers = {};
    },

    /**
     * Call `debounce` to collapse multiple requests for a named task into
     * one invocation which is made after the wait time has elapsed with
     * no new request.  If no wait time is given, the callback will be called
     * at microtask timing (guaranteed before paint).
     *
     *     debouncedClickAction: function(e) {
     *       // will not call `processClick` more than once per 100ms
     *       this.debounce('click', function() {
     *        this.processClick;
     *       }, 100);
     *     }
     *
     * @method debounce
     * @param {String} jobName String to indentify the debounce job.
     * @param {Function} callback Function that is called (with `this`
     *   context) when the wait time elapses.
     * @param {number} wait Optional wait time in milliseconds (ms) after the
     *   last signal that must elapse before invoking `callback`
     */
    debounce: function(jobName, callback, wait) {
      this._debouncers[jobName] = Polymer.Debounce.call(this,
        this._debouncers[jobName], callback, wait);
    },

    /**
     * Returns whether a named debouncer is active.
     *
     * @method isDebouncerActive
     * @param {String} jobName The name of the debouncer started with `debounce`
     * @return {boolean} Whether the debouncer is active (has not yet fired).
     */
    isDebouncerActive: function(jobName) {
      var debouncer = this._debouncers[jobName];
      return debouncer && debouncer.finish;
    },

    /**
     * Immediately calls the debouncer `callback` and inactivates it.
     *
     * @method flushDebouncer
     * @param {String} jobName The name of the debouncer started with `debounce`
     */
    flushDebouncer: function(jobName) {
      var debouncer = this._debouncers[jobName];
      if (debouncer) {
        debouncer.complete();
      }
    },

    /**
     * Cancels an active debouncer.  The `callback` will not be called.
     *
     * @method cancelDebouncer
     * @param {String} jobName The name of the debouncer started with `debounce`
     */
    cancelDebouncer: function(jobName) {
      var debouncer = this._debouncers[jobName];
      if (debouncer) {
        debouncer.stop();
      }
    }

  });


;

  Polymer.Base._addFeature({

    _registerFeatures: function() {
      // identity
      this._prepIs();
      // shared behaviors
      this._prepBehaviors();
      // inheritance
      this._prepExtends();
      // factory
      this._prepConstructor();
    },

    _prepBehavior: function() {},

    _initFeatures: function() {
      // setup debouncers
      this._setupDebouncers();
      // acquire behaviors
      this._marshalBehaviors();
    },

    _marshalBehavior: function(b) {
      // publish attributes to instance
      this._installHostAttributes(b.hostAttributes);
    }

  });


;

  /**
   * Automatic template management.
   * 
   * The `template` feature locates and instances a `<template>` element
   * corresponding to the current Polymer prototype.
   * 
   * The `<template>` element may be immediately preceeding the script that 
   * invokes `Polymer()`.
   *  
   * @class standard feature: template
   */
  
  Polymer.Base._addFeature({

    _prepTemplate: function() {
      // locate template using dom-module
      this._template = 
        this._template || Polymer.DomModule.import(this.is, 'template');
      // fallback to look at the node previous to the currentScript.
      if (!this._template) {
        var script = document._currentScript || document.currentScript;
        var prev = script && script.previousElementSibling;
        if (prev && prev.localName === 'template') {
          this._template = prev;
        }
      }
    },

    _stampTemplate: function() {
      if (this._template) {
        // note: root is now a fragment which can be manipulated
        // while not attached to the element.
        this.root = this.instanceTemplate(this._template);
      }
    },

    instanceTemplate: function(template) {
      var dom = 
        document.importNode(template._content || template.content, true);
      return dom;
    }

  });


;

  /**
   * Provides `ready` lifecycle callback which is called parent to child.
   *
   * This can be useful in a number of cases. Here are some examples:
   *
   * Setting a default property value that should have a side effect: To ensure
   * the side effect, an element must set a default value no sooner than
   * `created`; however, since `created` flows child to host, this is before the
   * host has had a chance to set a property value on the child. The `ready`
   * method solves this problem since it's called host to child.
   *
   * Dom distribution: To support reprojection efficiently, it's important to
   * distribute from host to child in one shot. The `attachedCallback` mostly
   * goes in the desired order except for elements that are in dom to start; in
   * this case, all children are attached before the host element. Ready also
   * addresses this case since it's guaranteed to be called host to child.
   *
   * @class standard feature: ready
   */

(function() {

  var baseAttachedCallback = Polymer.Base.attachedCallback;

  Polymer.Base._addFeature({

    _hostStack: [],

    // for overriding
    ready: function() {
    },

    // NOTE: The concept of 'host' is overloaded. There are two different
    // notions:
    // 1. an element hosts the elements in its local dom root.
    // 2. an element hosts the elements on which it configures data.
    // Practially, these notions are almost always coincident.
    // Some special elements like templates may separate them.
    // In order not to over-emphaisize this technical difference, we expose
    // one concept to the user and it maps to the dom-related meaning of host.
    //
    // 1. set this element's `host` and push this element onto the `host`'s
    // list of `client` elements
    // 2. establish this element as the current hosting element (allows
    // any elements we stamp to easily set host to us).
    _pushHost: function(host) {
      // NOTE: The `dataHost` of an element never changes.
      this.dataHost = host = host ||
        Polymer.Base._hostStack[Polymer.Base._hostStack.length-1];
      // this.dataHost reflects the parent element who manages
      // any bindings for the element.  Only elements originally
      // stamped from Polymer templates have a dataHost, and this
      // never changes
      if (host && host._clients) {
        host._clients.push(this);
      }
      this._beginHost();
    },

    _beginHost: function() {
      Polymer.Base._hostStack.push(this);
      if (!this._clients) {
        this._clients = [];
      }
    },

    _popHost: function() {
      // this element is no longer the current hosting element
      Polymer.Base._hostStack.pop();
    },

    _tryReady: function() {
      if (this._canReady()) {
        this._ready();
      }
    },

    _canReady: function() {
      return !this.dataHost || this.dataHost._clientsReadied;
    },

    _ready: function() {
      // extension point
      this._beforeClientsReady();
      this._readyClients();
      // extension point
      this._afterClientsReady();
      this._readySelf();
    },

    _readyClients: function() {
      // prepare root
      this._setupRoot();
      // logically distribute self
      this._beginDistribute();
      // now fully prepare localChildren
      var c$ = this._clients;
      for (var i=0, l= c$.length, c; (i<l) && (c=c$[i]); i++) {
        c._ready();
      }
      // perform actual dom composition
      this._finishDistribute();
      // ensure elements are attached if they are in the dom at ready time
      // helps normalize attached ordering between native and polyfill ce.
      // TODO(sorvell): worth perf cost? ~6%
      // if (!Polymer.Settings.useNativeCustomElements) {
      //   CustomElements.takeRecords();
      // }
      this._clientsReadied = true;
      this._clients = null;
    },

    // mark readied and call `ready`
    // note: called localChildren -> host
    _readySelf: function() {
      this._doBehavior('ready');
      this._readied = true;
      if (this._attachedPending) {
        this._attachedPending = false;
        this.attachedCallback();
      }
    },

    // for system overriding
    _beforeClientsReady: function() {},
    _afterClientsReady: function() {},

    // normalize lifecycle: ensure attached occurs only after ready.
    attachedCallback: function() {
      if (this._readied) {
        baseAttachedCallback.call(this);
      } else {
        this._attachedPending = true;
      }
    }

  });

})();


;

Polymer.ArraySplice = (function() {
  
  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  return new ArraySplice();

})();

;

  Polymer.EventApi = (function() {

    var Settings = Polymer.Settings;

    var EventApi = function(event) {
      this.event = event;
    };

    if (Settings.useShadow) {

      EventApi.prototype = {
        
        get rootTarget() {
          return this.event.path[0];
        },

        get localTarget() {
          return this.event.target;
        },

        get path() {
          return this.event.path;
        }

      };

    } else {

      EventApi.prototype = {
      
        get rootTarget() {
          return this.event.target;
        },

        get localTarget() {
          var current = this.event.currentTarget;
          var currentRoot = current && Polymer.dom(current).getOwnerRoot();
          var p$ = this.path;
          for (var i=0; i < p$.length; i++) {
            if (Polymer.dom(p$[i]).getOwnerRoot() === currentRoot) {
              return p$[i];
            }
          }
        },

        // TODO(sorvell): simulate event.path. This probably incorrect for
        // non-bubbling events.
        get path() {
          if (!this.event._path) {
            var path = [];
            var o = this.rootTarget;
            while (o) {
              path.push(o);
              o = Polymer.dom(o).parentNode || o.host;
            }
            // event path includes window in most recent native implementations
            path.push(window);
            this.event._path = path;
          }
          return this.event._path;
        }

      };

    }

    var factory = function(event) {
      if (!event.__eventApi) {
        event.__eventApi = new EventApi(event);
      }
      return event.__eventApi;
    };

    return {
      factory: factory
    };

  })();


;

Polymer.domInnerHTML = (function() {

  // Cribbed from ShadowDOM polyfill
  // https://github.com/webcomponents/webcomponentsjs/blob/master/src/ShadowDOM/wrappers/HTMLElement.js#L28
  /////////////////////////////////////////////////////////////////////////////
  // innerHTML and outerHTML

  // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#escapingString
  var escapeAttrRegExp = /[&\u00A0"]/g;
  var escapeDataRegExp = /[&\u00A0<>]/g;

  function escapeReplace(c) {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;'
      case '\u00A0':
        return '&nbsp;';
    }
  }

  function escapeAttr(s) {
    return s.replace(escapeAttrRegExp, escapeReplace);
  }

  function escapeData(s) {
    return s.replace(escapeDataRegExp, escapeReplace);
  }

  function makeSet(arr) {
    var set = {};
    for (var i = 0; i < arr.length; i++) {
      set[arr[i]] = true;
    }
    return set;
  }

  // http://www.whatwg.org/specs/web-apps/current-work/#void-elements
  var voidElements = makeSet([
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ]);

  var plaintextParents = makeSet([
    'style',
    'script',
    'xmp',
    'iframe',
    'noembed',
    'noframes',
    'plaintext',
    'noscript'
  ]);

  function getOuterHTML(node, parentNode, composed) {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        //var tagName = node.tagName.toLowerCase();
        var tagName = node.localName;
        var s = '<' + tagName;
        var attrs = node.attributes;
        for (var i = 0, attr; attr = attrs[i]; i++) {
          s += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"';
        }
        s += '>';
        if (voidElements[tagName]) {
          return s;
        }
        return s + getInnerHTML(node, composed) + '</' + tagName + '>';
      case Node.TEXT_NODE:
        var data = node.data;
        if (parentNode && plaintextParents[parentNode.localName]) {
          return data;
        }
        return escapeData(data);
      case Node.COMMENT_NODE:
        return '<!--' + node.data + '-->';
      default:
        console.error(node);
        throw new Error('not implemented');
    }
  }

  function getInnerHTML(node, composed) {
    if (node instanceof HTMLTemplateElement)
      node = node.content;
    var s = '';
    var c$ = Polymer.dom(node).childNodes;
    c$ = composed ? node._composedChildren : c$;
    for (var i=0, l=c$.length, child; (i<l) && (child=c$[i]); i++) {  
      s += getOuterHTML(child, node, composed);
    }
    return s;
  }

  return {
    getInnerHTML: getInnerHTML
  };

})();


;

  Polymer.DomApi = (function() {

    var Settings = Polymer.Settings;
    var getInnerHTML = Polymer.domInnerHTML.getInnerHTML;

    var nativeInsertBefore = Element.prototype.insertBefore;
    var nativeRemoveChild = Element.prototype.removeChild;
    var nativeAppendChild = Element.prototype.appendChild;

    var dirtyRoots = [];

    var DomApi = function(node) {
      this.node = node;
      if (this.patch) {
        this.patch();
      }
    };

    DomApi.prototype = {

      flush: function() {
        for (var i=0, host; i<dirtyRoots.length; i++) {
          host = dirtyRoots[i];
          host.flushDebouncer('_distribute');
        }
        dirtyRoots = [];
      },

      _lazyDistribute: function(host) {
        if (host.shadyRoot) {
          host.shadyRoot._distributionClean = false;
        }
        // TODO(sorvell): optimize debounce so it does less work by default
        // and then remove these checks...
        // need to dirty distribution once.
        if (!host.isDebouncerActive('_distribute')) {
          host.debounce('_distribute', host._distributeContent);
          dirtyRoots.push(host);
        }
      },

      // cases in which we may not be able to just do standard appendChild
      // 1. container has a shadyRoot (needsDistribution IFF the shadyRoot
      // has an insertion point)
      // 2. container is a shadyRoot (don't distribute, instead set
      // container to container.host.
      // 3. node is <content> (host of container needs distribution)
      appendChild: function(node) {
        var distributed;
        this._removeNodeFromHost(node);
        if (this._nodeIsInLogicalTree(this.node)) {
          var host = this._hostForNode(this.node);
          this._addLogicalInfo(node, this.node, host && host.shadyRoot);
          this._addNodeToHost(node);
          if (host) {
            distributed = this._maybeDistribute(node, this.node, host);
          }
        }
        if (!distributed) {
          // if adding to a shadyRoot, add to host instead
          var container = this.node._isShadyRoot ? this.node.host : this.node;
          nativeAppendChild.call(container, node);
          addToComposedParent(container, node);
        }
        return node;
      },

      insertBefore: function(node, ref_node) {
        if (!ref_node) {
          return this.appendChild(node);
        }
        var distributed;
        this._removeNodeFromHost(node);
        if (this._nodeIsInLogicalTree(this.node)) {
          saveLightChildrenIfNeeded(this.node);
          var children = this.childNodes;
          var index = children.indexOf(ref_node);
          if (index < 0) {
            throw Error('The ref_node to be inserted before is not a child ' +
              'of this node');
          }
          var host = this._hostForNode(this.node);
          this._addLogicalInfo(node, this.node, host && host.shadyRoot, index);
          this._addNodeToHost(node);
          if (host) {
            distributed = this._maybeDistribute(node, this.node, host);
          }
        }
        if (!distributed) {
          // if ref_node is <content> replace with first distributed node
          ref_node = ref_node.localName === CONTENT ?
            this._firstComposedNode(ref_node) : ref_node;
          // if adding to a shadyRoot, add to host instead
          var container = this.node._isShadyRoot ? this.node.host : this.node;
          nativeInsertBefore.call(container, node, ref_node);
          addToComposedParent(container, node, ref_node);
        }
        return node;
      },

      /**
        Removes the given `node` from the element's `lightChildren`.
        This method also performs dom composition.
      */
      removeChild: function(node) {
        var distributed;
        if (this._nodeIsInLogicalTree(this.node)) {
          var host = this._hostForNode(this.node);
          distributed = this._maybeDistribute(node, this.node, host);
          this._removeNodeFromHost(node);
        }
        if (!distributed) {
          // if removing from a shadyRoot, remove form host instead
          var container = this.node._isShadyRoot ? this.node.host : this.node;
          nativeRemoveChild.call(container, node);
          removeFromComposedParent(container, node);
        }
        return node;
      },

      replaceChild: function(node, ref_node) {
        this.insertBefore(node, ref_node);
        this.removeChild(ref_node);
        return node;
      },

      getOwnerRoot: function() {
        return this._ownerShadyRootForNode(this.node);
      },

      _ownerShadyRootForNode: function(node) {
        if (!node) {
          return;
        }
        if (node._ownerShadyRoot === undefined) {
          var root;
          if (node._isShadyRoot) {
            root = node;
          } else {
            var parent = Polymer.dom(node).parentNode;
            if (parent) {
              root = parent._isShadyRoot ? parent :
                this._ownerShadyRootForNode(parent);
            } else {
             root = null;
            }
          }
          node._ownerShadyRoot = root;
        }
        return node._ownerShadyRoot;

      },

      _maybeDistribute: function(node, parent, host) {
        var nodeNeedsDistribute = this._nodeNeedsDistribution(node);
        var distribute = this._parentNeedsDistribution(parent) ||
          nodeNeedsDistribute;
        if (nodeNeedsDistribute) {
          this._updateInsertionPoints(host);
        }
        if (distribute) {
          this._lazyDistribute(host);
        }
        return distribute;
      },

      _updateInsertionPoints: function(host) {
        host.shadyRoot._insertionPoints =
          factory(host.shadyRoot).querySelectorAll(CONTENT);
      },

      // a node is in a shadyRoot, is a shadyRoot, 
      // or has a lightParent
      _nodeIsInLogicalTree: function(node) {
        return Boolean(node.lightParent || node._isShadyRoot ||
          this._ownerShadyRootForNode(node) ||
          node.shadyRoot);
      },

      // note: a node is its own host
      _hostForNode: function(node) {
        var root = node.shadyRoot || (node._isShadyRoot ?
          node : this._ownerShadyRootForNode(node));
        return root && root.host;
      },

      _parentNeedsDistribution: function(parent) {
        return parent.shadyRoot && hasInsertionPoint(parent.shadyRoot);
      },

      // TODO(sorvell): technically we should check non-fragment nodes for
      // <content> children but since this case is assumed to be exceedingly
      // rare, we avoid the cost and will address with some specific api
      // when the need arises.
      _nodeNeedsDistribution: function(node) {
        return (node.localName === CONTENT) ||
          ((node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) &&
            node.querySelector(CONTENT));
      },

      _removeNodeFromHost: function(node) {
        if (node.lightParent) {
          var root = this._ownerShadyRootForNode(node);
          if (root) {
            root.host._elementRemove(node);
          }
          this._removeLogicalInfo(node, node.lightParent);
        }
        this._removeOwnerShadyRoot(node);
      },

      _addNodeToHost: function(node) {
        var checkNode = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ?
          node.firstChild : node;
        var root = this._ownerShadyRootForNode(checkNode);
        if (root) {
          root.host._elementAdd(node);
        }
      },

      _addLogicalInfo: function(node, container, root, index) {
        saveLightChildrenIfNeeded(container);
        var children = factory(container).childNodes;
        index = index === undefined ? children.length : index;
        // handle document fragments
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          // NOTE: the act of setting this info can affect patched nodes
          // getters; therefore capture childNodes before patching.
          var c$ = Array.prototype.slice.call(node.childNodes);
          for (var i=0, n; (i<c$.length) && (n=c$[i]); i++) {
            children.splice(index++, 0, n);
            n.lightParent = container;
          }
        } else {
          children.splice(index, 0, node);
          node.lightParent = container;
        }
      },

      // NOTE: in general, we expect contents of the lists here to be small-ish
      // and therefore indexOf to be nbd. Other optimizations can be made
      // for larger lists (linked list)
      _removeLogicalInfo: function(node, container) {
        var children = factory(container).childNodes;
        var index = children.indexOf(node);
        if ((index < 0) || (container !== node.lightParent)) {
          throw Error('The node to be removed is not a child of this node');
        }
        children.splice(index, 1);
        node.lightParent = null;
      },

      _removeOwnerShadyRoot: function(node) {
        // optimization: only reset the tree if node is actually in a root
        var hasCachedRoot = factory(node).getOwnerRoot() !== undefined;
        if (hasCachedRoot) {
          var c$ = factory(node).childNodes;
          for (var i=0, l=c$.length, n; (i<l) && (n=c$[i]); i++) {
            this._removeOwnerShadyRoot(n);
          }
        }
        node._ownerShadyRoot = undefined;
      },

      // TODO(sorvell): This will fail if distribution that affects this
      // question is pending; this is expected to be exceedingly rare, but if
      // the issue comes up, we can force a flush in this case.
      _firstComposedNode: function(content) {
        var n$ = factory(content).getDistributedNodes();
        for (var i=0, l=n$.length, n, p$; (i<l) && (n=n$[i]); i++) {
          p$ = factory(n).getDestinationInsertionPoints();
          // means that we're composed to this spot.
          if (p$[p$.length-1] === content) {
            return n;
          }
        }
      },

      // TODO(sorvell): consider doing native QSA and filtering results.
      querySelector: function(selector) {
        return this.querySelectorAll(selector)[0];
      },

      querySelectorAll: function(selector) {
        return this._query(function(n) {
          return matchesSelector.call(n, selector);
        }, this.node);
      },

      _query: function(matcher, node) {
        node = node || this.node;
        var list = [];
        this._queryElements(factory(node).childNodes, matcher, list);
        return list;
      },

      _queryElements: function(elements, matcher, list) {
        for (var i=0, l=elements.length, c; (i<l) && (c=elements[i]); i++) {
          if (c.nodeType === Node.ELEMENT_NODE) {
            this._queryElement(c, matcher, list);
          }
        }
      },

      _queryElement: function(node, matcher, list) {
        if (matcher(node)) {
          list.push(node);
        }
        this._queryElements(factory(node).childNodes, matcher, list);
      },

      getDestinationInsertionPoints: function() {
        return this.node._destinationInsertionPoints || [];
      },

      getDistributedNodes: function() {
        return this.node._distributedNodes || [];
      },

      /*
        Returns a list of nodes distributed within this element. These can be
        dom children or elements distributed to children that are insertion
        points.
      */
      queryDistributedElements: function(selector) {
        var c$ = this.childNodes;
        var list = [];
        this._distributedFilter(selector, c$, list);
        for (var i=0, l=c$.length, c; (i<l) && (c=c$[i]); i++) {
          if (c.localName === CONTENT) {
            this._distributedFilter(selector, factory(c).getDistributedNodes(),
              list);
          }
        }
        return list;
      },

      _distributedFilter: function(selector, list, results) {
        results = results || [];
        for (var i=0, l=list.length, d; (i<l) && (d=list[i]); i++) {
          if ((d.nodeType === Node.ELEMENT_NODE) &&
            (d.localName !== CONTENT) &&
            matchesSelector.call(d, selector)) {
            results.push(d);
          }
        }
        return results;
      },

      _clear: function() {
        while (this.childNodes.length) {
          this.removeChild(this.childNodes[0]);
        }
      }

    };

    // changes and accessors...
    if (!Settings.useShadow) {

      Object.defineProperties(DomApi.prototype, {

        childNodes: {
          get: function() {
            var c$ = getLightChildren(this.node);
            return Array.isArray(c$) ? c$ : Array.prototype.slice.call(c$);
          },
          configurable: true
        },

        children: {
          get: function() {
            return Array.prototype.filter.call(this.childNodes, function(n) {
              return (n.nodeType === Node.ELEMENT_NODE);
            });
          },
          configurable: true  
        },

        parentNode: {
          get: function() {
            return this.node.lightParent || 
              (this.node.__patched ? this.node._composedParent :
              this.node.parentNode);
          },
          configurable: true  
        },

        firstChild: {
          get: function() {
            return this.childNodes[0];
          },
          configurable: true  
        },

        lastChild: {
          get: function() {
            var c$ = this.childNodes;
            return c$[c$.length-1];
          },
          configurable: true  
        },

        nextSibling: {
          get: function() {
            var c$ = this.parentNode && factory(this.parentNode).childNodes;
            if (c$) {
              return c$[Array.prototype.indexOf.call(c$, this.node) + 1];
            }
          },
          configurable: true  
        },

        previousSibling: {
          get: function() {
            var c$ = this.parentNode && factory(this.parentNode).childNodes;
            if (c$) {
              return c$[Array.prototype.indexOf.call(c$, this.node) - 1];
            }
          },
          configurable: true  
        },

        firstElementChild: {
          get: function() {
            return this.children[0];
          },
          configurable: true  
        },

        lastElementChild: {
          get: function() {
            var c$ = this.children;
            return c$[c$.length-1];
          },
          configurable: true  
        },

        nextElementSibling: {
          get: function() {
            var c$ = this.parentNode && factory(this.parentNode).children;
            if (c$) {
              return c$[Array.prototype.indexOf.call(c$, this.node) + 1];
            }
          },
          configurable: true  
        },

        previousElementSibling: {
          get: function() {
            var c$ = this.parentNode && factory(this.parentNode).children;
            if (c$) {
              return c$[Array.prototype.indexOf.call(c$, this.node) - 1];
            }
          },
          configurable: true  
        },

        // textContent / innerHTML
        textContent: {
          get: function() {
            if (this.node.nodeType === Node.TEXT_NODE) {
              return this.node.textContent;
            } else {
              return Array.prototype.map.call(this.childNodes, function(c) {
                return c.textContent;
              }).join('');
            }
          },
          set: function(text) {
            this._clear();
            if (text) {
              this.appendChild(document.createTextNode(text));
            }
          },
          configurable: true  
        },

        innerHTML: {
          get: function() {
            if (this.node.nodeType === Node.TEXT_NODE) {
              return null;
            } else {
              return getInnerHTML(this.node);
            }
          },
          set: function(text) {
            if (this.node.nodeType !== Node.TEXT_NODE) {
              this._clear();
              var d = document.createElement('div');
              d.innerHTML = text;
              for (var e=d.firstChild; e; e=e.nextSibling) {
                this.appendChild(e);
              }
            }
          },
          configurable: true  
        }

      });

      DomApi.prototype._getComposedInnerHTML = function() {
        return getInnerHTML(this.node, true);
      };

    } else {

      DomApi.prototype.querySelectorAll = function(selector) {
        return Array.prototype.slice.call(this.node.querySelectorAll(selector));
      };

      DomApi.prototype.getOwnerRoot = function() {
        var n = this.node;
        while (n) {
          if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE && n.host) {
            return n;
          }
          n = n.parentNode;
        }
      };

      DomApi.prototype.getDestinationInsertionPoints = function() {
        var n$ = this.node.getDestinationInsertionPoints();
        return n$ ? Array.prototype.slice.call(n$) : [];
      };

      DomApi.prototype.getDistributedNodes = function() {
        var n$ = this.node.getDistributedNodes();
        return n$ ? Array.prototype.slice.call(n$) : [];
      };

      Object.defineProperties(DomApi.prototype, {

        childNodes: {
          get: function() {
            return Array.prototype.slice.call(this.node.childNodes);
          },
          configurable: true
        },

        children: {
          get: function() {
            return Array.prototype.slice.call(this.node.children);
          },
          configurable: true  
        },

        // textContent / innerHTML
        textContent: {
          get: function() {
            return this.node.textContent;
          },
          set: function(value) {
            return this.node.textContent = value;
          },
          configurable: true  
        },

        innerHTML: {
          get: function() {
            return this.node.innerHTML;
          },
          set: function(value) {
            return this.node.innerHTML = value;
          },
          configurable: true  
        }

      });

      var forwards = ['parentNode', 'firstChild', 'lastChild', 'nextSibling', 
      'previousSibling', 'firstElementChild', 'lastElementChild', 
      'nextElementSibling', 'previousElementSibling'];

      forwards.forEach(function(name) {
        Object.defineProperty(DomApi.prototype, name, {
          get: function() {
            return this.node[name];
          },
          configurable: true  
        });
      });

    }

    var CONTENT = 'content';

    var factory = function(node, patch) {
      node = node || document;
      if (!node.__domApi) {
        node.__domApi = new DomApi(node, patch);
      }
      return node.__domApi;
    };

    Polymer.dom = function(obj, patch) {
      if (obj instanceof Event) {
        return Polymer.EventApi.factory(obj);
      } else {
        return factory(obj, patch);
      }
    };

    // make flush available directly.
    Polymer.dom.flush = DomApi.prototype.flush;

    function getLightChildren(node) {
      var children = node.lightChildren;
      return children ? children : node.childNodes;
    }

    function getComposedChildren(node) {
      if (!node._composedChildren) {
        node._composedChildren = Array.prototype.slice.call(node.childNodes);
      }
      return node._composedChildren;
    }

    function addToComposedParent(parent, node, ref_node) {
      var children = getComposedChildren(parent);
      var i = ref_node ? children.indexOf(ref_node) : -1;
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        var fragChildren = getComposedChildren(node);
        fragChildren.forEach(function(c) {
          addNodeToComposedChildren(c, parent, children, i);
        });
      } else {
        addNodeToComposedChildren(node, parent, children, i);
      }
      
    }

    function addNodeToComposedChildren(node, parent, children, i) {
      node._composedParent = parent;
      if (i >= 0) {
        children.splice(i, 0, node);
      } else {
        children.push(node);
      }
    }

    function removeFromComposedParent(parent, node) {
      node._composedParent = null;
      if (parent) {
        var children = getComposedChildren(parent);
        var i = children.indexOf(node);
        if (i >= 0) {
          children.splice(i, 1);
        }
      }
    }

    function saveLightChildrenIfNeeded(node) {
      // Capture the list of light children. It's important to do this before we
      // start transforming the DOM into "rendered" state.
      //
      // Children may be added to this list dynamically. It will be treated as the
      // source of truth for the light children of the element. This element's
      // actual children will be treated as the rendered state once lightChildren
      // is populated.
      if (!node.lightChildren) {
        var c$ = Array.prototype.slice.call(node.childNodes);
        for (var i=0, l=c$.length, child; (i<l) && (child=c$[i]); i++) {
          child.lightParent = child.lightParent || node;
        }
        node.lightChildren = c$;
      }
    }

    function hasInsertionPoint(root) {
      return Boolean(root._insertionPoints.length);
    }

    var p = Element.prototype;
    var matchesSelector = p.matches || p.matchesSelector ||
        p.mozMatchesSelector || p.msMatchesSelector ||
        p.oMatchesSelector || p.webkitMatchesSelector;

    return {
      getLightChildren: getLightChildren,
      getComposedChildren: getComposedChildren,
      removeFromComposedParent: removeFromComposedParent,
      saveLightChildrenIfNeeded: saveLightChildrenIfNeeded,
      matchesSelector: matchesSelector,
      hasInsertionPoint: hasInsertionPoint,
      ctor: DomApi,
      factory: factory
    };

  })();


;

  (function() {
    /**

      Implements a pared down version of ShadowDOM's scoping, which is easy to
      polyfill across browsers.

    */
    Polymer.Base._addFeature({

      _prepShady: function() {
        // Use this system iff localDom is needed.
        this._useContent = this._useContent || Boolean(this._template);
        if (this._useContent) {
          this._template._hasInsertionPoint =
            this._template.content.querySelector('content');
        }
      },

      // called as part of content initialization, prior to template stamping
      _poolContent: function() {
        if (this._useContent) {
          // capture lightChildren to help reify dom scoping
          saveLightChildrenIfNeeded(this);
        }
      },

      // called as part of content initialization, after template stamping
      _setupRoot: function() {
        if (this._useContent) {
          this._createLocalRoot();
        }
      },

      _createLocalRoot: function() {
        this.shadyRoot = this.root;
        this.shadyRoot._distributionClean = false;
        this.shadyRoot._isShadyRoot = true;
        this.shadyRoot._dirtyRoots = [];
        // capture insertion point list
        // TODO(sorvell): it's faster to do this via native qSA than annotator.
        this.shadyRoot._insertionPoints = this._template._hasInsertionPoint ?
          this.shadyRoot.querySelectorAll('content') : [];
        // save logical tree info for shadyRoot.
        saveLightChildrenIfNeeded(this.shadyRoot);
        this.shadyRoot.host = this;
      },

      /**
       * Return the element whose local dom within which this element
       * is contained. This is a shorthand for
       * `Polymer.dom(this).getOwnerRoot().host`.
       */
      get domHost() {
        var root = Polymer.dom(this).getOwnerRoot();
        return root && root.host;
      },

      /**
       * Force this element to distribute its children to its local dom.
       * A user should call `distributeContent` if distribution has been
       * invalidated due to changes to selectors on child elements that
       * effect distribution. For example, if an element contains an
       * insertion point with <content select=".foo"> and a `foo` class is
       * added to a child, then `distributeContent` must be called to update
       * local dom distribution.
       */
      distributeContent: function() {
        if (this._useContent) {
          this.shadyRoot._distributionClean = false;
          this._distributeContent();
        }
      },

      _distributeContent: function() {
        if (this._useContent && !this.shadyRoot._distributionClean) {
          // logically distribute self
          this._beginDistribute();
          this._distributeDirtyRoots();
          this._finishDistribute();
        }
      },

      _beginDistribute: function() {
        if (this._useContent && hasInsertionPoint(this.shadyRoot)) {
          // reset distributions
          this._resetDistribution();
          // compute which nodes should be distributed where
          // TODO(jmesserly): this is simplified because we assume a single
          // ShadowRoot per host and no `<shadow>`.
          this._distributePool(this.shadyRoot, this._collectPool());
        }
      },

      _distributeDirtyRoots: function() {
        var c$ = this.shadyRoot._dirtyRoots;
        for (var i=0, l= c$.length, c; (i<l) && (c=c$[i]); i++) {
          c._distributeContent();
        }
        this.shadyRoot._dirtyRoots = [];
      },

      _finishDistribute: function() {
        // compose self
        if (this._useContent) {
          if (hasInsertionPoint(this.shadyRoot)) {
            this._composeTree();
          } else {
            if (!this.shadyRoot._hasDistributed) {
              this.textContent = '';
              this.appendChild(this.shadyRoot);
            } else {
              // simplified non-tree walk composition
              var children = this._composeNode(this);
              this._updateChildNodes(this, children);
            }
          }
          this.shadyRoot._hasDistributed = true;
          this.shadyRoot._distributionClean = true;
        }
      },

      // This is a polyfill for Element.prototype.matches, which is sometimes
      // still prefixed. Alternatively we could just polyfill it somewhere.
      // Note that the arguments are reversed from what you might expect.
      elementMatches: function(selector, node) {
        node = node || this;
        return matchesSelector.call(node, selector);
      },

      // Many of the following methods are all conceptually static, but they are
      // included here as "protected" methods to allow overriding.

      _resetDistribution: function() {
        // light children
        var children = getLightChildren(this);
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (child._destinationInsertionPoints) {
            child._destinationInsertionPoints = undefined;
          }
        }
        // insertion points
        var root = this.shadyRoot;
        var p$ = root._insertionPoints;
        for (var j = 0; j < p$.length; j++) {
          p$[j]._distributedNodes = [];
        }
      },

      // Gather the pool of nodes that should be distributed. We will combine
      // these with the "content root" to arrive at the composed tree.
      _collectPool: function() {
        var pool = [];
        var children = getLightChildren(this);
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (isInsertionPoint(child)) {
            pool.push.apply(pool, child._distributedNodes);
          } else {
            pool.push(child);
          }
        }
        return pool;
      },

      // perform "logical" distribution; note, no actual dom is moved here,
      // instead elements are distributed into a `content._distributedNodes`
      // array where applicable.
      _distributePool: function(node, pool) {
        var p$ = node._insertionPoints;
        for (var i=0, l=p$.length, p; (i<l) && (p=p$[i]); i++) {
          this._distributeInsertionPoint(p, pool);
        }
      },

      _distributeInsertionPoint: function(content, pool) {
        // distribute nodes from the pool that this selector matches
        var anyDistributed = false;
        for (var i=0, l=pool.length, node; i < l; i++) {
          node=pool[i];
          // skip nodes that were already used
          if (!node) {
            continue;
          }
          // distribute this node if it matches
          if (this._matchesContentSelect(node, content)) {
            distributeNodeInto(node, content);
            // remove this node from the pool
            pool[i] = undefined;
            // since at least one node matched, we won't need fallback content
            anyDistributed = true;
            var parent = content.lightParent;
            // dirty a shadyRoot if a change may trigger reprojection!
            if (parent && parent.shadyRoot &&
              hasInsertionPoint(parent.shadyRoot)) {
              parent.shadyRoot._distributionClean = false;
              this.shadyRoot._dirtyRoots.push(parent);
            }
          }
        }
        // Fallback content if nothing was distributed here
        if (!anyDistributed) {
          var children = getLightChildren(content);
          for (var j = 0; j < children.length; j++) {
            distributeNodeInto(children[j], content);
          }
        }
      },

      // Reify dom such that it is at its correct rendering position
      // based on logical distribution.
      _composeTree: function() {
        this._updateChildNodes(this, this._composeNode(this));
        var p$ = this.shadyRoot._insertionPoints;
        for (var i=0, l=p$.length, p, parent; (i<l) && (p=p$[i]); i++) {
          parent = p.lightParent || p.parentNode;
          if (!parent._useContent && (parent !== this) &&
            (parent !== this.shadyRoot)) {
            this._updateChildNodes(parent, this._composeNode(parent));
          }
        }
      },

      // Returns the list of nodes which should be rendered inside `node`.
      _composeNode: function(node) {
        var children = [];
        var c$ = getLightChildren(node.shadyRoot || node);
        for (var i = 0; i < c$.length; i++) {
          var child = c$[i];
          if (isInsertionPoint(child)) {
            var distributedNodes = child._distributedNodes;
            for (var j = 0; j < distributedNodes.length; j++) {
              var distributedNode = distributedNodes[j];
              if (isFinalDestination(child, distributedNode)) {
                children.push(distributedNode);
              }
            }
          } else {
            children.push(child);
          }
        }
        return children;
      },

      // Ensures that the rendered node list inside `container` is `children`.
      _updateChildNodes: function(container, children) {
        var composed = getComposedChildren(container);
        var splices =
          Polymer.ArraySplice.calculateSplices(children, composed);
        // process removals
        for (var i=0, d=0, s; (i<splices.length) && (s=splices[i]); i++) {
          for (var j=0, n; (j < s.removed.length) && (n=s.removed[j]); j++) {
            remove(n);
            composed.splice(s.index + d, 1);
          }
          d -= s.addedCount;
        }
        // process adds
        for (var i=0, s, next; (i<splices.length) && (s=splices[i]); i++) {
          next = composed[s.index];
          for (var j=s.index, n; j < s.index + s.addedCount; j++) {
            n = children[j];
            insertBefore(container, n, next);
            composed.splice(j, 0, n);
          }
        }
      },

      _matchesContentSelect: function(node, contentElement) {
        var select = contentElement.getAttribute('select');
        // no selector matches all nodes (including text)
        if (!select) {
          return true;
        }
        select = select.trim();
        // same thing if it had only whitespace
        if (!select) {
          return true;
        }
        // selectors can only match Elements
        if (!(node instanceof Element)) {
          return false;
        }
        // only valid selectors can match:
        //   TypeSelector
        //   *
        //   ClassSelector
        //   IDSelector
        //   AttributeSelector
        //   negation
        var validSelectors = /^(:not\()?[*.#[a-zA-Z_|]/;
        if (!validSelectors.test(select)) {
          return false;
        }
        return this.elementMatches(select, node);
      },

      // system override point
      _elementAdd: function() {},

      // system override point
      _elementRemove: function() {}

    });

    var saveLightChildrenIfNeeded = Polymer.DomApi.saveLightChildrenIfNeeded;
    var getLightChildren = Polymer.DomApi.getLightChildren;
    var matchesSelector = Polymer.DomApi.matchesSelector;
    var hasInsertionPoint = Polymer.DomApi.hasInsertionPoint;
    var getComposedChildren = Polymer.DomApi.getComposedChildren;
    var removeFromComposedParent = Polymer.DomApi.removeFromComposedParent;

    function distributeNodeInto(child, insertionPoint) {
      insertionPoint._distributedNodes.push(child);
      var points = child._destinationInsertionPoints;
      if (!points) {
        child._destinationInsertionPoints = [insertionPoint];
      // TODO(sorvell): _destinationInsertionPoints may not be cleared when
      // nodes are dynamically added/removed, therefore test before adding
      // insertion points.
      } else if (points.indexOf(insertionPoint) < 0) {
        points.push(insertionPoint);
      }
    }

    function isFinalDestination(insertionPoint, node) {
      var points = node._destinationInsertionPoints;
      return points && points[points.length - 1] === insertionPoint;
    }

    function isInsertionPoint(node) {
      // TODO(jmesserly): we could add back 'shadow' support here.
      return node.localName == 'content';
    }

    var nativeInsertBefore = Element.prototype.insertBefore;
    var nativeRemoveChild = Element.prototype.removeChild;

    function insertBefore(parentNode, newChild, refChild) {
      var newChildParent = getComposedParent(newChild);
      if (newChildParent !== parentNode) {
        removeFromComposedParent(newChildParent, newChild);
      }
      // remove child from its old parent first
      remove(newChild);
      // make sure we never lose logical DOM information:
      // if the parentNode doesn't have lightChildren, save that information now.
      saveLightChildrenIfNeeded(parentNode);
      // insert it into the real DOM
      nativeInsertBefore.call(parentNode, newChild, refChild || null);
      newChild._composedParent = parentNode;
    }

    function remove(node) {
      var parentNode = getComposedParent(node);
      if (parentNode) {
        // make sure we never lose logical DOM information:
        // if the parentNode doesn't have lightChildren, save that information now.
        saveLightChildrenIfNeeded(parentNode);
        node._composedParent = null;
        // remove it from the real DOM
        nativeRemoveChild.call(parentNode, node);
      }
    }

    function getComposedParent(node) {
      return node.__patched ? node._composedParent : node.parentNode;
    }
  })();


;
  
  /**
    Implements `shadyRoot` compatible dom scoping using native ShadowDOM.
  */

  // Transform styles if not using ShadowDOM or if flag is set.

  if (Polymer.Settings.useShadow) {

    Polymer.Base._addFeature({

      // no-op's when ShadowDOM is in use
      _poolContent: function() {},
      _beginDistribute: function() {},
      distributeContent: function() {},
      _distributeContent: function() {},
      _finishDistribute: function() {},
      
      // create a shadowRoot
      _createLocalRoot: function() {
        this.createShadowRoot();
        this.shadowRoot.appendChild(this.root);
        this.root = this.shadowRoot;
      }

    });

  }


;

  Polymer.DomModule = document.createElement('dom-module');

  Polymer.Base._addFeature({

    _registerFeatures: function() {
      // identity
      this._prepIs();
      // shared behaviors
      this._prepBehaviors();
      // inheritance
      this._prepExtends();
     // factory
      this._prepConstructor();
      // template
      this._prepTemplate();
      // dom encapsulation
      this._prepShady();
    },

    _prepBehavior: function() {},

    _initFeatures: function() {
      // manage local dom
      this._poolContent();
      // host stack
      this._pushHost();
      // instantiate template
      this._stampTemplate();
      // host stack
      this._popHost();
      // setup debouncers
      this._setupDebouncers();
      // instance shared behaviors
      this._marshalBehaviors();
      // top-down initial distribution, configuration, & ready callback
      this._tryReady();
    },

    _marshalBehavior: function(b) {
      // publish attributes to instance
      this._installHostAttributes(b.hostAttributes);
    }

  });


;
/**
 * Scans a template to produce an annotation list that that associates
 * metadata culled from markup with tree locations
 * metadata and information to associate the metadata with nodes in an instance.
 *
 * Supported expressions include:
 *
 * Double-mustache annotations in text content. The annotation must be the only
 * content in the tag, compound expressions are not supported.
 *
 *     <[tag]>{{annotation}}<[tag]>
 *
 * Double-escaped annotations in an attribute, either {{}} or [[]].
 *
 *     <[tag] someAttribute="{{annotation}}" another="[[annotation]]"><[tag]>
 *
 * `on-` style event declarations.
 *
 *     <[tag] on-<event-name>="annotation"><[tag]>
 *
 * Note that the `annotations` feature does not implement any behaviors
 * associated with these expressions, it only captures the data.
 *
 * Generated data-structure:
 *
 *     [
 *       {
 *         id: '<id>',
 *         events: [
 *           {
 *             name: '<name>'
 *             value: '<annotation>'
 *           }, ...
 *         ],
 *         bindings: [
 *           {
 *             kind: ['text'|'attribute'],
 *             mode: ['{'|'['],
 *             name: '<name>'
 *             value: '<annotation>'
 *           }, ...
 *         ],
 *         // TODO(sjmiles): this is annotation-parent, not node-parent
 *         parent: <reference to parent annotation object>,
 *         index: <integer index in parent's childNodes collection>
 *       },
 *       ...
 *     ]
 *
 * @class Template feature
 */

  // null-array (shared empty array to avoid null-checks)
  Polymer.nar = [];

  Polymer.Annotations = {

    // preprocess-time

    // construct and return a list of annotation records
    // by scanning `template`'s content
    //
    parseAnnotations: function(template) {
      var list = [];
      var content = template._content || template.content;
      this._parseNodeAnnotations(content, list);
      return list;
    },

    // add annotations gleaned from subtree at `node` to `list`
    _parseNodeAnnotations: function(node, list) {
      return node.nodeType === Node.TEXT_NODE ?
        this._parseTextNodeAnnotation(node, list) :
          // TODO(sjmiles): are there other nodes we may encounter
          // that are not TEXT_NODE but also not ELEMENT?
          this._parseElementAnnotations(node, list);
    },

    _testEscape: function(value) {
      var escape = value.slice(0, 2);
      if (escape === '{{' || escape === '[[') {
        return escape;
      }
    },

    // add annotations gleaned from TextNode `node` to `list`
    _parseTextNodeAnnotation: function(node, list) {
      var v = node.textContent;
      var escape = this._testEscape(v);
      if (escape) {
        // NOTE: use a space here so the textNode remains; some browsers
        // (IE) evacipate an empty textNode.
        node.textContent = ' ';
        var annote = {
          bindings: [{
            kind: 'text',
            mode: escape[0],
            value: v.slice(2, -2)
          }]
        };
        list.push(annote);
        return annote;
      }
    },

    // add annotations gleaned from Element `node` to `list`
    _parseElementAnnotations: function(element, list) {
      var annote = {
        bindings: [],
        events: []
      };
      this._parseChildNodesAnnotations(element, annote, list);
      // TODO(sjmiles): is this for non-ELEMENT nodes? If so, we should
      // change the contract of this method, or filter these out above.
      if (element.attributes) {
        this._parseNodeAttributeAnnotations(element, annote, list);
        // TODO(sorvell): ad hoc callback for doing work on elements while
        // leveraging annotator's tree walk.
        // Consider adding an node callback registry and moving specific
        // processing out of this module.
        if (this.prepElement) {
          this.prepElement(element);
        }
      }
      if (annote.bindings.length || annote.events.length || annote.id) {
        list.push(annote);
      }
      return annote;
    },

    // add annotations gleaned from children of `root` to `list`, `root`'s
    // `annote` is supplied as it is the annote.parent of added annotations
    _parseChildNodesAnnotations: function(root, annote, list, callback) {
      if (root.firstChild) {
        for (var i=0, node=root.firstChild; node; node=node.nextSibling, i++){
          if (node.localName === 'template' &&
            !node.hasAttribute('preserve-content')) {
            this._parseTemplate(node, i, list, annote);
          }
          //
          var childAnnotation = this._parseNodeAnnotations(node, list, callback);
          if (childAnnotation) {
            childAnnotation.parent = annote;
            childAnnotation.index = i;
          }
        }
      }
    },

    // 1. Parse annotations from the template and memoize them on
    //    content._notes (recurses into nested templates)
    // 2. Parse template bindings for parent.* properties and memoize them on
    //    content._parentProps
    // 3. Create bindings in current scope's annotation list to template for
    //    parent props found in template
    // 4. Remove template.content and store it in annotation list, where it
    //    will be the responsibility of the host to set it back to the template
    //    (this is both an optimization to avoid re-stamping nested template
    //    children and avoids a bug in Chrome where nested template children
    //    upgrade)
    _parseTemplate: function(node, index, list, parent) {
      // TODO(sjmiles): simply altering the .content reference didn't
      // work (there was some confusion, might need verification)
      var content = document.createDocumentFragment();
      content._notes = this.parseAnnotations(node);
      content.appendChild(node.content);
      // Special-case treatment of 'parent.*' props for nested templates
      // Automatically bind `prop` on host to `_parent_prop` on template
      // for any `parent.prop`'s encountered in template binding; it is
      // responsibility of the template implementation to forward
      // these properties as appropriate
      var bindings = [];
      this._discoverTemplateParentProps(content);
      for (var prop in content._parentProps) {
        bindings.push({
          index: index,
          kind: 'property',
          mode: '{',
          name: '_parent_' + prop,
          value: prop
        });
      }
      // TODO(sjmiles): using `nar` to avoid unnecessary allocation;
      // in general the handling of these arrays needs some cleanup
      // in this module
      list.push({
        bindings: bindings,
        events: Polymer.nar,
        templateContent: content,
        parent: parent,
        index: index
      });
    },

    // Finds all bindings in template content and stores the path roots in
    // the path members in content._parentProps. Each outer template merges
    // inner _parentProps to propagate inner parent property needs to outer
    // templates.
    _discoverTemplateParentProps: function(content) {
      var pp = content._parentProps = {};
      content._notes.forEach(function(n) {
        // Find all bindings to parent.* and spread them into _parentPropChain
        n.bindings.forEach(function(b) {
          var prop = b.value;
          var dot = prop.indexOf('.');
          prop = (dot < 0) ? prop : prop.slice(0, dot);
          pp[prop] = true;
        });
        // Merge child _parentProps into this _parentProps
        if (n.templateContent) {
          var tpp = n.templateContent._parentProps;
          Polymer.Base.mixin(pp, tpp);
        }
      });
    },

    // add annotation data from attributes to the `annotation` for node `node`
    // TODO(sjmiles): the distinction between an `annotation` and
    // `annotation data` is not as clear as it could be
    // Walk attributes backwards, since removeAttribute can be vetoed by
    // IE in certain cases (e.g. <input value="foo">), resulting in the
    // attribute staying in the attributes list
    _parseNodeAttributeAnnotations: function(node, annotation) {
      for (var i=node.attributes.length-1, a; (a=node.attributes[i]); i--) {
        var n = a.name, v = a.value;
        // id (unless actually an escaped binding annotation)
        if (n === 'id' && !this._testEscape(v)) {
          annotation.id = v;
        }
        // events (on-*)
        else if (n.slice(0, 3) === 'on-') {
          node.removeAttribute(n);
          annotation.events.push({
            name: n.slice(3),
            value: v
          });
        }
        // bindings (other attributes)
        else {
          var b = this._parseNodeAttributeAnnotation(node, n, v);
          if (b) {
            annotation.bindings.push(b);
          }
        }
      }
    },

    // construct annotation data from a generic attribute, or undefined
    _parseNodeAttributeAnnotation: function(node, n, v) {
      var escape = this._testEscape(v);
      if (escape) {
        var customEvent;
        // Cache name (`n` will be mangled)
        var name = n;
        // Mode (one-way or two)
        var mode = escape[0];
        v = v.slice(2, -2);
        // Negate
        var not = false;
        if (v[0] == '!') {
          v = v.substring(1);
          not = true;
        }
        // Attribute or property
        var kind = 'property';
        if (n[n.length-1] == '$') {
          name = n.slice(0, -1);
          kind = 'attribute';
        }
        // Custom notification event
        var notifyEvent, colon;
        if (mode == '{' && (colon = v.indexOf('::')) > 0) {
          notifyEvent = v.substring(colon + 2);
          v = v.substring(0, colon);
          customEvent = true;
        }
        // Remove annotation
        node.removeAttribute(n);
        // Case hackery: attributes are lower-case, but bind targets
        // (properties) are case sensitive. Gambit is to map dash-case to
        // camel-case: `foo-bar` becomes `fooBar`.
        // Attribute bindings are excepted.
        if (kind === 'property') {
          name = Polymer.CaseMap.dashToCamelCase(name);
        }
        return {
          kind: kind,
          mode: mode,
          name: name,
          value: v,
          negate: not,
          event: notifyEvent,
          customEvent: customEvent
        };
      }
    },

    // instance-time

    _localSubTree: function(node, host) {
      return (node === host) ? node.childNodes :
         (node.lightChildren || node.childNodes);
    },

    findAnnotatedNode: function(root, annote) {
      // recursively ascend tree until we hit root
      var parent = annote.parent &&
        Polymer.Annotations.findAnnotatedNode(root, annote.parent);
      // unwind the stack, returning the indexed node at each level
      return !parent ? root :
        Polymer.Annotations._localSubTree(parent, root)[annote.index];
    }

  };


;

  (function() {

    // path fixup for urls in cssText that's expected to 
    // come from a given ownerDocument
    function resolveCss(cssText, ownerDocument) {
      return cssText.replace(CSS_URL_RX, function(m, pre, url, post) {
        return pre + '\'' + 
          resolve(url.replace(/["']/g, ''), ownerDocument) + 
          '\'' + post;
      });
    }

    // url fixup for urls in an element's attributes made relative to 
    // ownerDoc's base url
    function resolveAttrs(element, ownerDocument) {
      for (var name in URL_ATTRS) {
        var a$ = URL_ATTRS[name];
        for (var i=0, l=a$.length, a, at, v; (i<l) && (a=a$[i]); i++) {
          if (name === '*' || element.localName === name) {
            at = element.attributes[a];
            v = at && at.value;
            if (v && (v.search(BINDING_RX) < 0)) {
              at.value = (a === 'style') ?
                resolveCss(v, ownerDocument) :
                resolve(v, ownerDocument);
            }
          }
        }
      }
    }

    function resolve(url, ownerDocument) {
      var resolver = getUrlResolver(ownerDocument);
      resolver.href = url;
      return resolver.href || url;
    }

    var tempDoc;
    var tempDocBase;
    function resolveUrl(url, baseUri) {
      if (!tempDoc) {
        tempDoc = document.implementation.createHTMLDocument('temp');
        tempDocBase = tempDoc.createElement('base');
        tempDoc.head.appendChild(tempDocBase);
      }
      tempDocBase.href = baseUri;
      return resolve(url, tempDoc);
    }

    function getUrlResolver(ownerDocument) {
      return ownerDocument.__urlResolver || 
        (ownerDocument.__urlResolver = ownerDocument.createElement('a'));
    }

    var CSS_URL_RX = /(url\()([^)]*)(\))/g;
    var URL_ATTRS = {
      '*': ['href', 'src', 'style', 'url'],
      form: ['action']
    };
    var BINDING_RX = /\{\{|\[\[/;

    // exports
    Polymer.ResolveUrl = {
      resolveCss: resolveCss,
      resolveAttrs: resolveAttrs,
      resolveUrl: resolveUrl
    };

  })();


;

/**
 * Scans a template to produce an annotation object that stores expression
 * metadata along with information to associate the metadata with nodes in an
 * instance.
 *
 * Elements with `id` in the template are noted and marshaled into an
 * the `$` hash in an instance.
 *
 * Example
 *
 *     &lt;template>
 *       &lt;div id="foo">&lt;/div>
 *     &lt;/template>
 *     &lt;script>
 *      Polymer({
 *        task: function() {
 *          this.$.foo.style.color = 'red';
 *        }
 *      });
 *     &lt;/script>
 *
 * Other expressions that are noted include:
 *
 * Double-mustache annotations in text content. The annotation must be the only
 * content in the tag, compound expressions are not (currently) supported.
 *
 *     <[tag]>{{path.to.host.property}}<[tag]>
 *
 * Double-mustache annotations in an attribute.
 *
 *     <[tag] someAttribute="{{path.to.host.property}}"><[tag]>
 *
 * Only immediate host properties can automatically trigger side-effects.
 * Setting `host.path` in the example above triggers the binding, setting
 * `host.path.to.host.property` does not.
 *
 * `on-` style event declarations.
 *
 *     <[tag] on-<event-name>="{{hostMethodName}}"><[tag]>
 *
 * Note: **the `annotations` feature does not actually implement the behaviors
 * associated with these expressions, it only captures the data**.
 *
 * Other optional features contain actual data implementations.
 *
 * @class standard feature: annotations
 */

/*

Scans a template to produce an annotation map that stores expression metadata
and information that associates the metadata to nodes in a template instance.

Supported annotations are:

  * id attributes
  * binding annotations in text nodes
    * double-mustache expressions: {{expression}}
    * double-bracket expressions: [[expression]]
  * binding annotations in attributes
    * attribute-bind expressions: name="{{expression}} || [[expression]]"
    * property-bind expressions: name*="{{expression}} || [[expression]]"
    * property-bind expressions: name:="expression"
  * event annotations
    * event delegation directives: on-<eventName>="expression"

Generated data-structure:

  [
    {
      id: '<id>',
      events: [
        {
          mode: ['auto'|''],
          name: '<name>'
          value: '<expression>'
        }, ...
      ],
      bindings: [
        {
          kind: ['text'|'attribute'|'property'],
          mode: ['auto'|''],
          name: '<name>'
          value: '<expression>'
        }, ...
      ],
      // TODO(sjmiles): confusingly, this is annotation-parent, not node-parent
      parent: <reference to parent annotation>,
      index: <integer index in parent's childNodes collection>
    },
    ...
  ]

TODO(sjmiles): this module should produce either syntactic metadata
(e.g. double-mustache, double-bracket, star-attr), or semantic metadata
(e.g. manual-bind, auto-bind, property-bind). Right now it's half and half.

*/

  Polymer.Base._addFeature({

    // registration-time

    _prepAnnotations: function() {
      if (!this._template) {
        this._notes = [];
      } else {
        // TODO(sorvell): ad hoc method of plugging behavior into Annotations
        Polymer.Annotations.prepElement = this._prepElement.bind(this);
        this._notes = Polymer.Annotations.parseAnnotations(this._template);
        Polymer.Annotations.prepElement = null;
      }
    },

    _prepElement: function(element) {
      Polymer.ResolveUrl.resolveAttrs(element, this._template.ownerDocument);
    },

    // instance-time

    _findAnnotatedNode: Polymer.Annotations.findAnnotatedNode,

    // marshal all teh things
    _marshalAnnotationReferences: function() {
      if (this._template) {
        this._marshalIdNodes();
        this._marshalAnnotatedNodes();
        this._marshalAnnotatedListeners();
      }
    },

    // push configuration references at configure time
    _configureAnnotationReferences: function() {
      this._configureTemplateContent();
    },

    // nested template contents have been stored prototypically to avoid
    // unnecessary duplication, here we put references to the
    // indirected contents onto the nested template instances
    _configureTemplateContent: function() {
      this._notes.forEach(function(note) {
        if (note.templateContent) {
          var template = this._findAnnotatedNode(this.root, note);
          template._content = note.templateContent;
        }
      }, this);
    },

    // construct `$` map (from id annotations)
    _marshalIdNodes: function() {
      this.$ = {};
      this._notes.forEach(function(a) {
        if (a.id) {
          this.$[a.id] = this._findAnnotatedNode(this.root, a);
        }
      }, this);
    },

    // concretize `_nodes` map (from anonymous annotations)
    _marshalAnnotatedNodes: function() {
      if (this._nodes) {
        this._nodes = this._nodes.map(function(a) {
          return this._findAnnotatedNode(this.root, a);
        }, this);
      }
    },

    // install event listeners (from event annotations)
    _marshalAnnotatedListeners: function() {
      this._notes.forEach(function(a) {
        if (a.events && a.events.length) {
          var node = this._findAnnotatedNode(this.root, a);
          a.events.forEach(function(e) {
            this.listen(node, e.name, e.value);
          }, this);
        }
      }, this);
    }

  });


;

  /**
   * Supports `listeners` object.
   *
   * Example:
   *
   *
   *     Polymer({
   *
   *       listeners: {
   *         // `click` events on the host are delegated to `clickHandler`
   *         'click': 'clickHandler'
   *       },
   *
   *       ...
   *
   *     });
   *
   *
   * @class standard feature: events
   *
   */

  Polymer.Base._addFeature({

    listeners: {},

    _listenListeners: function(listeners) {
      var node, name, key;
      for (key in listeners) {
        if (key.indexOf('.') < 0) {
          node = this;
          name = key;
        } else {
          name = key.split('.');
          node = this.$[name[0]];
          name = name[1];
        }
        this.listen(node, name, listeners[key]);
      }
    },

    listen: function(node, eventName, methodName) {
      this._listen(node, eventName, this._createEventHandler(node, eventName, methodName));
    },

    _createEventHandler: function(node, eventName, methodName) {
      var host = this;
      return function(e) {
        if (host[methodName]) {
          host[methodName](e, e.detail);
        } else {
          console.warn('[%s]: event handler [%s] is null in scope (%o)',
            node.localName, eventName, methodName, host);
        }
      };
    },

    _listen: function(node, eventName, handler) {
      node.addEventListener(eventName, handler);
    },

    // TODO(dfreedm): remove when a11y keys element is ported
    keyCodes: {
      ESC_KEY: 27,
      ENTER_KEY: 13,
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      SPACE: 32
    }

  });


;
(function() {

  'use strict';

  // detect native touch action support
  var HAS_NATIVE_TA = typeof document.head.style.touchAction === 'string';
  var GESTURE_KEY = '__polymerGestures';
  var HANDLED_OBJ = '__polymerGesturesHandled';
  var TOUCH_ACTION = '__polymerGesturesTouchAction';
  var TAP_DISTANCE = 25;

  // Disabling "mouse" handlers for 500ms is enough
  var MOUSE_TIMEOUT = 500;
  var MOUSE_EVENTS = ['mousedown', 'mousemove', 'mouseup', 'click'];

  // touch will make synthetic mouse events
  // `preventDefault` on touchend will cancel them,
  // but this breaks `<input>` focus and link clicks
  // disable mouse handlers for MOUSE_TIMEOUT ms after
  // a touchend to ignore synthetic mouse events
  var MOUSE_CANCELLER = function(mouseEvent) {
    mouseEvent[HANDLED_OBJ] = {skip: true};
    // disable "ghost clicks"
    if (mouseEvent.type === 'click') {
      var path = Polymer.dom(mouseEvent).path;
      for (var i = 0; i < path.length; i++) {
        if (path[i] === POINTERSTATE.mouse.target) {
          return;
        }
      }
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
    }
  };

  function IGNORE_MOUSE(set) {
    for (var i = 0, en; i < MOUSE_EVENTS.length; i++) {
      en = MOUSE_EVENTS[i];
      if (set) {
        document.addEventListener(en, MOUSE_CANCELLER, true);
      } else {
        document.removeEventListener(en, MOUSE_CANCELLER, true);
      }
    }
    if (set) {
      // disable MOUSE_CANCELLER after MOUSE_TIMEOUT ms
      setTimeout(IGNORE_MOUSE, MOUSE_TIMEOUT);
    } else {
      POINTERSTATE.mouse.target = null;
    }
  }

  var POINTERSTATE = {
    tapPrevented: false,
    mouse: {
      target: null,
    },
    touch: {
      x: 0,
      y: 0,
      id: 0,
      scrollDecided: false
    }
  };

  function firstTouchAction(ev) {
    var path = Polymer.dom(ev).path;
    var ta = 'auto';
    for (var i = 0, n; i < path.length; i++) {
      n = path[i];
      if (n[TOUCH_ACTION]) {
        ta = n[TOUCH_ACTION];
        break;
      }
    }
    return ta;
  }

  function deepTargetFind(x, y) {
    var node = document.elementFromPoint(x, y);
    var next = node.shadowRoot;
    while(next) {
      next = next.elementFromPoint(x, y);
      if (next) {
        node = next;
      }
    }
    return node;
  }

  var Gestures = {
    gestures: {},
    recognizers: [],

    handleNative: function(ev) {
      var handled;
      var type = ev.type;
      var node = ev.currentTarget;
      var gobj = node[GESTURE_KEY];
      var gs = gobj[type];
      if (!gs) {
        return;
      }
      if (!ev[HANDLED_OBJ]) {
        ev[HANDLED_OBJ] = {};
        if (type === 'touchstart') {
          if (POINTERSTATE.touch.id === -1) {
            POINTERSTATE.touch.id = ev.changedTouches[0].touchIdentifier;
          }
        }
        if (!HAS_NATIVE_TA) {
          if (type === 'touchstart' || type === 'touchmove') {
            Gestures.handleTouchAction(ev);
          }
        }
        if (type === 'touchend') {
          POINTERSTATE.mouse.target = Polymer.dom(ev).rootTarget;
        }
      }
      // only handle the first finger
      if (type.slice(0, 5) === 'touch') {
        if (POINTERSTATE.touch.id !== ev.changedTouches[0].touchIdentifier) {
          return;
        }
      }
      handled = ev[HANDLED_OBJ];
      if (handled.skip) {
        return;
      }
      var recognizers = Gestures.recognizers;
      // enforce gesture recognizer order
      for (var i = 0, r; i < recognizers.length; i++) {
        r = recognizers[i];
        if (gs[r.name] && !handled[r.name]) {
          handled[r.name] = true;
          r[type](ev);
        }
      }
      // ignore syntethic mouse events after a touch
      if (type === 'touchend') {
        POINTERSTATE.touch.id = -1;
        IGNORE_MOUSE(true);
      }
    },

    handleTouchAction: function(ev) {
      var t = ev.changedTouches[0];
      var type = ev.type;
      if (type === 'touchstart') {
        POINTERSTATE.touch.x = t.clientX;
        POINTERSTATE.touch.y = t.clientY;
        POINTERSTATE.touch.scrollDecided = false;
      } else if (type === 'touchmove') {
        if (POINTERSTATE.touch.scrollDecided) {
          return;
        }
        POINTERSTATE.touch.scrollDecided = true;
        var ta = firstTouchAction(ev);
        var prevent = false;
        var dx = Math.abs(POINTERSTATE.touch.x - t.clientX);
        var dy = Math.abs(POINTERSTATE.touch.y - t.clientY);
        if (!ev.cancelable) {
          // scrolling is happening
        } else if (ta === 'none') {
          prevent = true;
        } else if (ta === 'pan-x') {
          prevent = dx >= dy;
        } else if (ta === 'pan-y') {
          prevent = dy > dx;
        }
        if (prevent) {
          ev.preventDefault();
        }
      }
    },

    // automate the event listeners for the native events
    add: function(node, evType, handler) {
      var recognizer = this.gestures[evType];
      var deps = recognizer.deps;
      var name = recognizer.name;
      var gobj = node[GESTURE_KEY];
      if (!gobj) {
        node[GESTURE_KEY] = gobj = {};
      }
      for (var i = 0, dep, gd; i < deps.length; i++) {
        dep = deps[i];
        gd = gobj[dep];
        if (!gd) {
          gobj[dep] = gd = {};
          node.addEventListener(dep, this.handleNative);
        }
        gd[name] = (gd[name] || 0) + 1;
      }
      node.addEventListener(evType, handler);
      if (recognizer.touchaction) {
        this.setTouchAction(node, recognizer.touchaction);
      }
    },

    register: function(recog) {
      this.recognizers.push(recog);
      for (var i = 0; i < recog.emits.length; i++) {
        this.gestures[recog.emits[i]] = recog;
      }
    },

    // set scrolling direction on node to check later on first move
    // must call this before adding event listeners!
    setTouchAction: function(node, value) {
      if (HAS_NATIVE_TA) {
        node.style.touchAction = value;
      }
      node[TOUCH_ACTION] = value;
    },

    fire: function(target, type, detail) {
      var ev = new CustomEvent(type, {
        detail: detail,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(ev);
    }
  };

  Gestures.register({
    name: 'downup',
    deps: ['mousedown', 'touchstart', 'touchend'],
    emits: ['down', 'up'],

    mousedown: function(e) {
      var t = e.currentTarget;
      var self = this;
      var upfn = function upfn(e) {
        self.fire('up', t, e);
        document.removeEventListener('mouseup', upfn);
      };
      document.addEventListener('mouseup', upfn);
      this.fire('down', t, e);
    },
    touchstart: function(e) {
      this.fire('down', e.currentTarget, e.changedTouches[0]);
    },
    touchend: function(e) {
      this.fire('up', e.currentTarget, e.changedTouches[0]);
    },
    fire: function(type, target, event) {
      Gestures.fire(target, type, {
        x: event.clientX,
        y: event.clientY,
        sourceEvent: event
      });
    }
  });

  Gestures.register({
    name: 'track',
    touchaction: 'none',
    deps: ['mousedown', 'touchmove', 'touchend'],
    emits: ['track'],

    info: {
      state: 'start',
      started: 'true',
      moves: [],
      addMove: function(move) {
        if (this.moves.length > 5) {
          this.moves.splice(1, 1);
        }
        this.moves.push(move);
      }
    },

    clearInfo: function() {
      this.info.state = 'start';
      this.info.started = false;
      this.info.moves = [];
    },

    mousedown: function(e) {
      var t = e.currentTarget;
      var self = this;
      var movefn = function movefn(e) {
        // first move is 'start', subsequent moves are 'move', mouseup is 'end'
        self.info.state = self.info.started ? (e.type === 'mouseup' ? 'end' : 'track') : 'start';
        self.info.addMove({x: e.clientX, y: e.clientY});
        self.fire(t, e);
        e.preventDefault();
        self.info.started = true;
      };
      var upfn = function upfn(e) {
        if (self.info.state !== 'start') {
          POINTERSTATE.tapPrevented = true;
          movefn(e);
        }
        self.clearInfo();
        // remove the temporary listeners
        document.removeEventListener('mousemove', movefn);
        document.removeEventListener('mouseup', upfn);
      };
      // add temporary document listeners as mouse retargets
      document.addEventListener('mousemove', movefn);
      document.addEventListener('mouseup', upfn);
    },

    touchmove: function(e) {
      var t = e.currentTarget;
      var ct = e.changedTouches[0];
      this.info.addMove({x: ct.clientX, y: ct.clientY});
      this.fire(t, ct);
      this.info.state = 'track';
    },

    touchend: function(e) {
      var t = e.currentTarget;
      var ct = e.changedTouches[0];
      // only trackend if track was started and not aborted
      if (this.info.state !== 'start') {
        // iff tracking, always prevent tap
        POINTERSTATE.tapPrevented = true;
        // reset started state on up
        this.info.state = 'end';
        this.info.addMove({x: ct.clientX, y: ct.clientY});
        this.fire(t, ct);
      }
      this.clearInfo();
    },

    fire: function(target, touch) {
      var secondlast = this.info.moves[this.info.moves.length - 2];
      var lastmove = this.info.moves[this.info.moves.length - 1];
      var firstmove = this.info.moves[0];
      var dx, dy = 0;
      if (firstmove) {
        dx = lastmove.x - firstmove.x;
        dy = lastmove.y - firstmove.y;
      }
      var ddx, ddy = 0;
      if (secondlast) {
        ddx = lastmove.x - secondlast.x;
        ddy = lastmove.y - secondlast.y;
      }
      return Gestures.fire(target, 'track', {
        state: this.info.state,
        x: touch.clientX,
        y: touch.clientY,
        dx: dx,
        dy: dy,
        ddx: ddx,
        ddy: ddy,
        hover: function() {
          return deepTargetFind(touch.clientX, touch.clientY);
        }
      });
    }

  });

  Gestures.register({
    name: 'tap',
    deps: ['mousedown', 'click', 'touchstart', 'touchend'],
    emits: ['tap'],
    start: {
      x: 0,
      y: 0
    },
    reset: function() {
      this.start.x = 0;
      this.start.y = 0;
    },
    save: function(e) {
      this.start.x = e.clientX;
      this.start.y = e.clientY;
    },

    mousedown: function(e) {
      this.save(e);
    },
    click: function(e) {
      this.forward(e);
    },

    touchstart: function(e) {
      this.save(e.changedTouches[0]);
    },
    touchend: function(e) {
      this.forward(e.changedTouches[0]);
    },

    forward: function(e) {
      var dx = Math.abs(e.clientX - this.start.x);
      var dy = Math.abs(e.clientY - this.start.y);
      // dx,dy can be NaN if `click` has been simulated and there was no `down` for `start`
      if (isNaN(dx) || isNaN(dy) || dx <= TAP_DISTANCE || dy <= TAP_DISTANCE) {
        // prevent taps from being generated if an event has canceled them
        if (!POINTERSTATE.tapPrevented) {
          Gestures.fire(e.target, 'tap', {
            x: e.clientX,
            y: e.clientY,
            sourceEvent: e
          });
        }
      }
      POINTERSTATE.tapPrevented = false;
      this.reset();
    }
  });

  var DIRECTION_MAP = {
    x: 'pan-x',
    y: 'pan-y',
    none: 'none',
    all: 'auto'
  };

  Polymer.Base._addFeature({
    // override _addListener to handle gestures
    _listen: function(node, eventName, handler) {
      if (Gestures.gestures[eventName]) {
        Gestures.add(node, eventName, handler);
      } else {
        node.addEventListener(eventName, handler);
      }
    },
    setScrollDirection: function(node, direction) {
      Gestures.setTouchAction(node, DIRECTION_MAP[direction] || 'auto');
    }
  });

  // export

  Polymer.Gestures = Gestures;

})();

;

Polymer.Async = (function() {
  
  var currVal = 0;
  var lastVal = 0;
  var callbacks = [];
  var twiddle = document.createTextNode('');

  function runAsync(callback, waitTime) {
    if (waitTime > 0) {
      return ~setTimeout(callback, waitTime);
    } else {
      twiddle.textContent = currVal++;
      callbacks.push(callback);
      return currVal - 1;
    }
  }

  function cancelAsync(handle) {
    if (handle < 0) {
      clearTimeout(~handle);
    } else {
      var idx = handle - lastVal;
      if (idx >= 0) {
        if (!callbacks[idx]) {
          throw 'invalid async handle: ' + handle;
        }
        callbacks[idx] = null;
      }
    }
  }

  function atEndOfMicrotask() {
    var len = callbacks.length;
    for (var i=0; i<len; i++) {
      var cb = callbacks[i];
      if (cb) {
        cb();
      }
    }
    callbacks.splice(0, len);
    lastVal += len;
  }

  new (window.MutationObserver || JsMutationObserver)(atEndOfMicrotask)
    .observe(twiddle, {characterData: true})
    ;
  
  // exports 

  return {
    run: runAsync,
    cancel: cancelAsync
  };
  
})();


;

Polymer.Debounce = (function() {
  
  // usage
  
  // invoke cb.call(this) in 100ms, unless the job is re-registered,
  // which resets the timer
  // 
  // this.job = this.debounce(this.job, cb, 100)
  //
  // returns a handle which can be used to re-register a job

  var Async = Polymer.Async;
  
  var Debouncer = function(context) {
    this.context = context;
    this.boundComplete = this.complete.bind(this);
  };
  
  Debouncer.prototype = {
    go: function(callback, wait) {
      var h;
      this.finish = function() {
        Async.cancel(h);
      };
      h = Async.run(this.boundComplete, wait);
      this.callback = callback;
    },
    stop: function() {
      if (this.finish) {
        this.finish();
        this.finish = null;
      }
    },
    complete: function() {
      if (this.finish) {
        this.stop();
        this.callback.call(this.context);
      }
    }
  };

  function debounce(debouncer, callback, wait) {
    if (debouncer) {
      debouncer.stop();
    } else {
      debouncer = new Debouncer(this);
    }
    debouncer.go(callback, wait);
    return debouncer;
  }
  
  // exports 

  return debounce;
  
})();


;

  Polymer.Base._addFeature({

    $$: function(slctr) {
      return Polymer.dom(this.root).querySelector(slctr);
    },

    /**
     * Toggles a CSS class on or off.
     *
     * @method toggleClass
     * @param {String} name CSS class name
     * @param {boolean=} bool Boolean to force the class on or off.
     *    When unspecified, the state of the class will be reversed.
     * @param {HTMLElement=} node Node to target.  Defaults to `this`.
     */
    toggleClass: function(name, bool, node) {
      node = node || this;
      if (arguments.length == 1) {
        bool = !node.classList.contains(name);
      }
      if (bool) {
        node.classList.add(name);
      } else {
        node.classList.remove(name);
      }
    },

    /**
     * Toggles an HTML attribute on or off.
     *
     * @method toggleAttribute
     * @param {String} name HTML attribute name
     * @param {boolean=} bool Boolean to force the attribute on or off.
     *    When unspecified, the state of the attribute will be reversed.
     * @param {HTMLElement=} node Node to target.  Defaults to `this`.
     */
    toggleAttribute: function(name, bool, node) {
      node = node || this;
      if (arguments.length == 1) {
        bool = !node.hasAttribute(name);
      }
      if (bool) {
        node.setAttribute(name, '');
      } else {
        node.removeAttribute(name);
      }
    },

    /**
     * Removes a class from one node, and adds it to another.
     *
     * @method classFollows
     * @param {String} name CSS class name
     * @param {HTMLElement} toElement New element to add the class to.
     * @param {HTMLElement} fromElement Old element to remove the class from.
     */
    classFollows: function(name, toElement, fromElement) {
      if (fromElement) {
        fromElement.classList.remove(name);
      }
      if (toElement) {
        toElement.classList.add(name);
      }
    },

    /**
     * Removes an HTML attribute from one node, and adds it to another.
     *
     * @method attributeFollows
     * @param {String} name HTML attribute name
     * @param {HTMLElement} toElement New element to add the attribute to.
     * @param {HTMLElement} fromElement Old element to remove the attribute from.
     */
    attributeFollows: function(name, toElement, fromElement) {
      if (fromElement) {
        fromElement.removeAttribute(name);
      }
      if (toElement) {
        toElement.setAttribute(name, '');
      }
    },

    /**
     * Returns a list of nodes distributed to this element's `<content>`.
     *
     * If this element contans more than one `<content>` in its local DOM,
     * an optional selector may be passed to choose the desired content.
     *
     * @method getContentChildNodes
     * @param {String=} slctr CSS selector to choose the desired
     *   `<content>`.  Defaults to `content`.
     * @return {Array<Node>} List of distributed nodes for the `<content>`.
     */
    getContentChildNodes: function(slctr) {
      return Polymer.dom(Polymer.dom(this.root).querySelector(
          slctr || 'content')).getDistributedNodes();
    },

    /**
     * Returns a list of element children distributed to this element's
     * `<content>`.
     *
     * If this element contans more than one `<content>` in its
     * local DOM, an optional selector may be passed to choose the desired
     * content.  This method differs from `getContentChildNodes` in that only
     * elements are returned.
     *
     * @method getContentChildNodes
     * @param {String=} slctr CSS selector to choose the desired
     *   `<content>`.  Defaults to `content`.
     * @return {Array<HTMLElement>} List of distributed nodes for the
     *   `<content>`.
     */
    getContentChildren: function(slctr) {
      return this.getContentChildNodes(slctr).filter(function(n) {
        return (n.nodeType === Node.ELEMENT_NODE);
      });
    },

    /**
     * Dispatches a custom event with an optional detail object.
     *
     * @method fire
     * @param {String} type Name of event type.
     * @param {Object=} detail Detail object containing event-specific
     *   payload.
     * @param {Object=} options Object specifying options.  These
     *   may include `bubbles` (boolean), `cancelable` (boolean), and `node`
     *   on which to fire the event (HTMLElement, defaults to `this`).
     * @return {CustomEvent} The new event that was fired.
     */
    fire: function(type, detail, options) {
      options = options || Polymer.nob;
      var node = options.node || this;
      var detail = (detail === null || detail === undefined) ? Polymer.nob : detail;
      var bubbles = options.bubbles === undefined ? true : options.bubbles;
      var event = new CustomEvent(type, {
        bubbles: Boolean(bubbles),
        cancelable: Boolean(options.cancelable),
        detail: detail
      });
      node.dispatchEvent(event);
      return event;
    },

    /**
     * Runs a callback function asyncronously.
     *
     * By default (if no waitTime is specified), async callbacks are run at
     * microtask timing, which will occur before paint.
     *
     * @method async
     * @param {Function} callback The callback function to run, bound to `this`.
     * @param {number=} waitTime Time to wait before calling the
     *   `callback`.  If unspecified or 0, the callback will be run at microtask
     *   timing (before paint).
     * @return {number} Handle that may be used to cancel the async job.
     */
    async: function(callback, waitTime) {
      return Polymer.Async.run(callback.bind(this), waitTime);
    },

    /**
     * Cancels an async operation started with `async`.
     *
     * @method cancelAsync
     * @param {number} handle Handle returned from original `async` call to
     *   cancel.
     */
    cancelAsync: function(handle) {
      Polymer.Async.cancel(handle);
    },

    /**
     * Removes an item from an array, if it exists.
     *
     * @method arrayDelete
     * @param {String|Array} path Path torray from which to remove the item
     *   (or the array itself).
     * @param {any} item Item to remove.
     * @return {Array} Array containing item removed.
     */
    arrayDelete: function(path, item) {
      var index;
      if (Array.isArray(path)) {
        index = path.indexOf(item);
        if (index >= 0) {
          return path.splice(index, 1);
        }
      } else {
        var arr = this.get(path);
        index = arr.indexOf(item);
        if (index >= 0) {
          return this.splice(path, index, 1);
        }
      }
    },

    /**
     * Cross-platform helper for setting an element's CSS `transform` property.
     *
     * @method transform
     * @param {String} transform Transform setting.
     * @param {HTMLElement=} node Element to apply the transform to.
     * Defaults to `this`
     */
    transform: function(transform, node) {
      node = node || this;
      node.style.webkitTransform = transform;
      node.style.transform = transform;
    },

    /**
     * Cross-platform helper for setting an element's CSS `translate3d`
     * property.
     *
     * @method translate3d
     * @param {number} x X offset.
     * @param {number} y Y offset.
     * @param {number} z Z offset.
     * @param {HTMLElement=} node Element to apply the transform to.
     * Defaults to `this`.
     */
    translate3d: function(x, y, z, node) {
      node = node || this;
      this.transform('translate3d(' + x + ',' + y + ',' + z + ')', node);
    },

    importHref: function(href, onload, onerror) {
      var l = document.createElement('link');
      l.rel = 'import';
      l.href = href;
      if (onload) {
        l.onload = onload.bind(this);
      }
      if (onerror) {
        l.onerror = onerror.bind(this);
      }
      document.head.appendChild(l);
      return l;
    },

    create: function(tag, props) {
      var elt = document.createElement(tag);
      if (props) {
        for (var n in props) {
          elt[n] = props[n];
        }
      }
      return elt;
    },

    mixin: function(a, b) {
      for (var i in b) {
        a[i] = b[i];
      }
    }

  });


;

  Polymer.Bind = {

    // for prototypes (usually)

    prepareModel: function(model) {
      model._propertyEffects = {};
      model._bindListeners = [];
      // TODO(sjmiles): no mixin function?
      var api = this._modelApi;
      for (var n in api) {
        model[n] = api[n];
      }
    },

    _modelApi: {

      _notifyChange: function(property) {
        var eventName = Polymer.CaseMap.camelToDashCase(property) + '-changed';
        // TODO(sjmiles): oops, `fire` doesn't exist at this layer
        this.fire(eventName, {
          value: this[property]
        }, {bubbles: false});
      },

      // TODO(sjmiles): removing _notifyListener from here breaks accessors.html
      // as a standalone lib. This is temporary, as standard/configure.html
      // installs it's own version on Polymer.Base, and we need that to work
      // right now.
      // NOTE: exists as a hook for processing listeners
      /*
      _notifyListener: function(fn, e) {
        // NOTE: pass e.target because e.target can get lost if this function
        // is queued asynchrously
        return fn.call(this, e, e.target);
      },
      */

      _propertySet: function(property, value, effects) {
        var old = this.__data__[property];
        if (old !== value) {
          this.__data__[property] = value;
          if (typeof value == 'object') {
            this._clearPath(property);
          }
          if (this._propertyChanged) {
            this._propertyChanged(property, value, old);
          }
          if (effects) {
            this._effectEffects(property, value, effects, old);
          }
        }
        return old;
      },

      _effectEffects: function(property, value, effects, old) {
        effects.forEach(function(fx) {
          //console.log(fx);
          var fn = Polymer.Bind['_' + fx.kind + 'Effect'];
          if (fn) {
            fn.call(this, property, value, fx.effect, old);
          }
        }, this);
      },

      _clearPath: function(path) {
        for (var prop in this.__data__) {
          if (prop.indexOf(path + '.') === 0) {
            this.__data__[prop] = undefined;
          }
        }
      }

    },

    // a prepared model can acquire effects

    ensurePropertyEffects: function(model, property) {
      var fx = model._propertyEffects[property];
      if (!fx) {
        fx = model._propertyEffects[property] = [];
      }
      return fx;
    },

    addPropertyEffect: function(model, property, kind, effect) {
      var fx = this.ensurePropertyEffects(model, property);
      fx.push({
        kind: kind,
        effect: effect
      });
    },

    createBindings: function(model) {
      //console.group(model.is);
      // map of properties to effects
      var fx$ = model._propertyEffects;
      if (fx$) {
        // for each property with effects
        for (var n in fx$) {
          // array of effects
          var fx = fx$[n];
          // effects have priority
          fx.sort(this._sortPropertyEffects);
          // create accessors
          this._createAccessors(model, n, fx);
        }
      }
      //console.groupEnd();
    },

    _sortPropertyEffects: (function() {
      // TODO(sjmiles): EFFECT_ORDER buried this way is not ideal,
      // but presumably the sort method is going to be a hot path and not
      // have a `this`. There is also a problematic dependency on effect.kind
      // values here, which are otherwise pluggable.
      var EFFECT_ORDER = {
        'compute': 0,
        'annotation': 1,
        'computedAnnotation': 2,
        'reflect': 3,
        'notify': 4,
        'observer': 5,
        'complexObserver': 6,
        'function': 7
      };
      return function(a, b) {
        return EFFECT_ORDER[a.kind] - EFFECT_ORDER[b.kind];
      };
    })(),

    // create accessors that implement effects

    _createAccessors: function(model, property, effects) {
      var defun = {
        get: function() {
          // TODO(sjmiles): elide delegation for performance, good ROI?
          return this.__data__[property];
        }
      };
      var setter = function(value) {
        this._propertySet(property, value, effects);
      };
      // ReadOnly properties have a private setter only
      // TODO(kschaaf): Per current Bind factoring, we shouldn't
      // be interrogating the prototype here
      if (model.getPropertyInfo && model.getPropertyInfo(property).readOnly) {
        model['_set' + this.upper(property)] = setter;
      } else {
        defun.set = setter;
      }
      Object.defineProperty(model, property, defun);
    },

    upper: function(name) {
      return name[0].toUpperCase() + name.substring(1);
    },

    _addAnnotatedListener: function(model, index, property, path, event) {
      var fn = this._notedListenerFactory(property, path,
        this._isStructured(path), this._isEventBogus);
      var eventName = event ||
        (Polymer.CaseMap.camelToDashCase(property) + '-changed');
      model._bindListeners.push({
        index: index,
        property: property,
        path: path,
        changedFn: fn,
        event: eventName
      });
    },

    _isStructured: function(path) {
      return path.indexOf('.') > 0;
    },

    _isEventBogus: function(e, target) {
      return e.path && e.path[0] !== target;
    },

    _notedListenerFactory: function(property, path, isStructured, bogusTest) {
      return function(e, target) {
        if (!bogusTest(e, target)) {
          if (e.detail && e.detail.path) {
            this.notifyPath(this._fixPath(path, property, e.detail.path),
              e.detail.value);
          } else {
            var value = target[property];
            if (!isStructured) {
              this[path] = target[property];
            } else {
              // TODO(kschaaf): dirty check avoids null references when the object has gone away
              if (this.__data__[path] != value) {
                this.set(path, value);
              }
            }
          }
        }
      };
    },

    // for instances

    prepareInstance: function(inst) {
      inst.__data__ = Object.create(null);
    },

    setupBindListeners: function(inst) {
      inst._bindListeners.forEach(function(info) {
        // Property listeners:
        // <node>.on.<property>-changed: <path]> = e.detail.value
        //console.log('[_setupBindListener]: [%s][%s] listening for [%s][%s-changed]', this.localName, info.path, info.id || info.index, info.property);
        var node = inst._nodes[info.index];
        node.addEventListener(info.event, inst._notifyListener.bind(inst, info.changedFn));
      });
    }

  };


;

  Polymer.Base.extend(Polymer.Bind, {

    _shouldAddListener: function(effect) {
      return effect.name &&
             effect.mode === '{' &&
             !effect.negate &&
             effect.kind != 'attribute'
             ;
    },

    _annotationEffect: function(source, value, effect) {
      if (source != effect.value) {
        value = this.get(effect.value);
        this.__data__[effect.value] = value;
      }
      var calc = effect.negate ? !value : value;
      // For better interop, dirty check before setting when custom events
      // are used, since the target element may not dirty check (e.g. <input>)
      if (!effect.customEvent ||
          this._nodes[effect.index][effect.name] !== calc) {
        return this._applyEffectValue(calc, effect);
      }
    },

    _reflectEffect: function(source) {
      this.reflectPropertyToAttribute(source);
    },

    _notifyEffect: function(source) {
      this._notifyChange(source);
    },

    // Raw effect for extension
    _functionEffect: function(source, value, fn, old) {
      fn.call(this, source, value, old);
    },

    _observerEffect: function(source, value, effect, old) {
      this[effect.method](value, old);
    },

    _complexObserverEffect: function(source, value, effect) {
      var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
      if (args) {
        this[effect.method].apply(this, args);
      }
    },

    _computeEffect: function(source, value, effect) {
      var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
      if (args) {
        this[effect.property] = this[effect.method].apply(this, args);
      }
    },

    _annotatedComputationEffect: function(source, value, effect) {
      var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
      if (args) {
        var computedHost = this._rootDataHost || this;
        var computedvalue =
          computedHost[effect.method].apply(computedHost, args);
        this._applyEffectValue(computedvalue, effect);
      }
    },

    // path & value are used to fill in wildcard descriptor when effect is
    // being called as a result of a path notification
    _marshalArgs: function(model, effect, path, value) {
      var values = [];
      var args = effect.args;
      for (var i=0, l=args.length; i<l; i++) {
        var arg = args[i];
        var name = arg.name;
        var v = arg.structured ?
          Polymer.Base.get(name, model) : model[name];
        if (args.length > 1 && v === undefined) {
          return;
        }
        if (arg.wildcard) {
          // Only send the actual path changed info if the change that
          // caused the observer to run matched the wildcard
          var baseChanged = (name.indexOf(path + '.') === 0);
          var matches = (effect.arg.name.indexOf(name) === 0 && !baseChanged);
          values[i] = {
            path: matches ? path : name,
            value: matches ? value : v,
            base: v
          };
        } else {
          values[i] = v;
        }
      }
      return values;
    }

  });


;

  /**
   * Support for property side effects.
   *
   * Key for effect objects:
   *
   * property | ann | anCmp | cmp | obs | cplxOb | description
   * ---------|-----|-------|-----|-----|--------|----------------------------------------
   * method   |     | X     | X   | X   | X      | function name to call on instance
   * args     |     | X     | X   |     | X      | list of all arg descriptors for fn
   * arg      |     | X     | X   |     | X      | arg descriptor for effect
   * property |     |       | X   | X   |        | property for effect to set or get
   * name     | X   |       |     |     |        | annotation value (text inside {{...}})
   * kind     | X   | X     |     |     |        | binding type (property or attribute)
   * index    | X   | X     |     |     |        | node index to set
   *
   */

  Polymer.Base._addFeature({

    _addPropertyEffect: function(property, kind, effect) {
     // TODO(sjmiles): everything to the right of the first '.' is lost, implies
     // there is some duplicate information flow (not the only sign)
     var model = property.split('.').shift();
     Polymer.Bind.addPropertyEffect(this, model, kind, effect);
    },

    // prototyping

    _prepEffects: function() {
      Polymer.Bind.prepareModel(this);
      this._addAnnotationEffects(this._notes);
    },

    _prepBindings: function() {
      Polymer.Bind.createBindings(this);
    },

    _addPropertyEffects: function(properties) {
      if (properties) {
        for (var p in properties) {
          var prop = properties[p];
          if (prop.observer) {
            this._addObserverEffect(p, prop.observer);
          }
          if (prop.computed) {
            this._addComputedEffect(p, prop.computed);
          }
          if (prop.notify) {
            this._addPropertyEffect(p, 'notify');
          }
          if (prop.reflectToAttribute) {
            this._addPropertyEffect(p, 'reflect');
          }
          if (prop.readOnly) {
            // Ensure accessor is created
            Polymer.Bind.ensurePropertyEffects(this, p);
          }
        }
      }
    },

    _parseMethod: function(expression) {
      var m = expression.match(/(\w*)\((.*)\)/);
      if (m) {
        return {
          method: m[1],
          args: m[2].split(/[^\w.*]+/).map(this._parseArg)
        };
      }
    },

    _parseArg: function(arg) {
      var a = { name: arg };
      a.structured = arg.indexOf('.') > 0;
      if (a.structured) {
        a.wildcard = (arg.slice(-2) == '.*');
        if (a.wildcard) {
          a.name = arg.slice(0, -2);
        }
      }
      return a;
    },

    _addComputedEffect: function(name, expression) {
      var sig = this._parseMethod(expression);
      sig.args.forEach(function(arg) {
        this._addPropertyEffect(arg.name, 'compute', {
          method: sig.method,
          args: sig.args,
          arg: arg,
          property: name
        });
      }, this);
    },

    _addObserverEffect: function(property, observer) {
      this._addPropertyEffect(property, 'observer', {
        method: observer,
        property: property
      });
    },

    _addComplexObserverEffects: function(observers) {
      if (observers) {
        observers.forEach(function(observer) {
          this._addComplexObserverEffect(observer);
        }, this);
      }
    },

    _addComplexObserverEffect: function(observer) {
      var sig = this._parseMethod(observer);
      sig.args.forEach(function(arg) {
        this._addPropertyEffect(arg.name, 'complexObserver', {
          method: sig.method,
          args: sig.args,
          arg: arg
        });
      }, this);
    },

    _addAnnotationEffects: function(notes) {
      // create a virtual annotation list, must be concretized at instance time
      this._nodes = [];
      // process annotations that have been parsed from template
      notes.forEach(function(note) {
        // where to find the node in the concretized list
        var index = this._nodes.push(note) - 1;
        note.bindings.forEach(function(binding) {
          this._addAnnotationEffect(binding, index);
        }, this);
      }, this);
    },

    _addAnnotationEffect: function(note, index) {
      // TODO(sjmiles): annotations have 'effects' proper and 'listener'
      if (Polymer.Bind._shouldAddListener(note)) {
        // <node>.on.<dash-case-property>-changed: <path> = e.detail.value
        Polymer.Bind._addAnnotatedListener(this, index,
          note.name, note.value, note.event);
      }
      var sig = this._parseMethod(note.value);
      if (sig) {
        this._addAnnotatedComputationEffect(sig, note, index);
      } else {
        // capture the node index
        note.index = index;
        // discover top-level property (model) from path
        var model = note.value.split('.').shift();
        // add 'annotation' binding effect for property 'model'
        this._addPropertyEffect(model, 'annotation', note);
      }
    },

    _addAnnotatedComputationEffect: function(sig, note, index) {
      sig.args.forEach(function(arg) {
        this._addPropertyEffect(arg.name, 'annotatedComputation', {
          kind: note.kind,
          method: sig.method,
          args: sig.args,
          arg: arg,
          property: note.name,
          index: index
        });
      }, this);
    },

    // instancing

    _marshalInstanceEffects: function() {
      Polymer.Bind.prepareInstance(this);
      Polymer.Bind.setupBindListeners(this);
    },

    _applyEffectValue: function(value, info) {
      var node = this._nodes[info.index];
      // TODO(sorvell): ideally, the info object is normalized for easy
      // lookup here.
      var property = info.property || info.name || 'textContent';
      // special processing for 'class' and 'className'; 'class' handled
      // when attr is serialized.
      if (info.kind == 'attribute') {
        this.serializeValueToAttribute(value, property, node);
      } else {
        // TODO(sorvell): consider pre-processing this step so we don't need
        // this lookup.
        if (property === 'className') {
          value = this._scopeElementClass(node, value);
        }
        return node[property] = value;
      }
    }

  });


;

  /*
    Process inputs efficiently via a configure lifecycle callback.
    Configure is called top-down, host before local dom. Users should
    implement configure to supply a set of default values for the element by
    returning an object containing the properties and values to set.

    Configured values are not immediately set, instead they are set when
    an element becomes ready, after its local dom is ready. This ensures
    that any user change handlers are not called before ready time.

  */

  /*
  Implementation notes:

  Configured values are collected into _config. At ready time, properties
  are set to the values in _config. This ensures properties are set child
  before host and change handlers are called only at ready time. The host
  will reset a value already propagated to a child, but this is not
  inefficient because of dirty checking at the set point.

  Bind notification events are sent when properties are set at ready time
  and thus received by the host before it is ready. Since notifications result
  in property updates and this triggers side effects, handling notifications
  is deferred until ready time.

  In general, events can be heard before an element is ready. This may occur
  when a user sends an event in a change handler or listens to a data event
  directly (on-foo-changed).
  */

  Polymer.Base._addFeature({

    // storage for configuration
    _setupConfigure: function(initialConfig) {
      this._config = initialConfig || {};
      this._handlers = [];
    },

    // static attributes are deserialized into _config
    _takeAttributes: function() {
      this._takeAttributesToModel(this._config);
    },

    // at configure time values are stored in _config
    _configValue: function(name, value) {
      this._config[name] = value;
    },

    // Override polymer-mini thunk
    _beforeClientsReady: function() {
      this._configure();
    },

    // configure: returns user supplied default property values
    // combines with _config to create final property values
    _configure: function() {
      this._configureAnnotationReferences();
      // get individual default values from property configs
      var config = {};
      // mixed-in behaviors
      this.behaviors.forEach(function(b) {
        this._configureProperties(b.properties, config);
      }, this);
      // prototypical behavior
      this._configureProperties(this.properties, config);
      // get add'l default values from central configure
      // combine defaults returned from configure with inputs in _config
      this._mixinConfigure(config, this._config);
      // this is the new _config, which are the final values to be applied
      this._config = config;
      // pass configuration data to bindings
      this._distributeConfig(this._config);
    },

    _configureProperties: function(properties, config) {
      for (var i in properties) {
        var c = properties[i];
        if (c.value !== undefined) {
          var value = c.value;
          if (typeof value == 'function') {
            // pass existing config values (this._config) to value function
            value = value.call(this, this._config);
          }
          config[i] = value;
        }
      }
    },

    _mixinConfigure: function(a, b) {
      for (var prop in b) {
        if (!this.getPropertyInfo(prop).readOnly) {
          a[prop] = b[prop];
        }
      }
    },

    // distribute config values to bound nodes.
    _distributeConfig: function(config) {
      var fx$ = this._propertyEffects;
      if (fx$) {
        for (var p in config) {
          var fx = fx$[p];
          if (fx) {
            for (var i=0, l=fx.length, x; (i<l) && (x=fx[i]); i++) {
              if (x.kind === 'annotation') {
                var node = this._nodes[x.effect.index];
                // seeding configuration only
                if (node._configValue) {
                  var value = (p === x.effect.value) ? config[p] :
                    this.get(x.effect.value, config);
                  node._configValue(x.effect.name, value);
                }
              }
            }
          }
        }
      }
    },

    // Override polymer-mini thunk
    _afterClientsReady: function() {
      this._applyConfig(this._config);
      this._flushHandlers();
    },

    // NOTE: values are already propagated to children via
    // _distributeConfig so propagation triggered by effects here is
    // redundant, but safe due to dirty checking
    _applyConfig: function(config) {
      for (var n in config) {
        // Don't stomp on values that may have been set by other side effects
        if (this[n] === undefined) {
          // Call _propertySet for any properties with accessors, which will
          // initialize read-only properties also
          // TODO(kschaaf): consider passing fromAbove here to prevent
          // unnecessary notify for: 1) possible perf, 2) debuggability
          var effects = this._propertyEffects[n];
          if (effects) {
            this._propertySet(n, config[n], effects);
          } else {
            this[n] = config[n];
          }
        }
      }
    },

    // NOTE: Notifications can be processed before ready since
    // they are sent at *child* ready time. Since notifications cause side
    // effects and side effects must not be processed before ready time,
    // handling is queue/defered until then.
    _notifyListener: function(fn, e) {
      if (!this._clientsReadied) {
        this._queueHandler([fn, e, e.target]);
      } else {
        return fn.call(this, e, e.target);
      }
    },

    _queueHandler: function(args) {
      this._handlers.push(args);
    },

    _flushHandlers: function() {
      var h$ = this._handlers;
      for (var i=0, l=h$.length, h; (i<l) && (h=h$[i]); i++) {
        h[0].call(this, h[1], h[2]);
      }
    }

  });


;

  /**
   * Changes to an object sub-field (aka "path") via a binding
   * (e.g. `<x-foo value="{{item.subfield}}"`) will notify other elements bound to
   * the same object automatically.
   *
   * When modifying a sub-field of an object imperatively
   * (e.g. `this.item.subfield = 42`), in order to have the new value propagated
   * to other elements, a special `set(path, value)` API is provided.
   * `set` sets the object field at the path specified, and then notifies the
   * binding system so that other elements bound to the same path will update.
   *
   * Example:
   *
   *     Polymer({
   *
   *       is: 'x-date',
   *
   *       properties: {
   *         date: {
   *           type: Object,
   *           notify: true
   *          }
   *       },
   *
   *       attached: function() {
   *         this.date = {};
   *         setInterval(function() {
   *           var d = new Date();
   *           // Required to notify elements bound to date of changes to sub-fields
   *           // this.date.seconds = d.getSeconds(); <-- Will not notify
   *           this.set('date.seconds', d.getSeconds());
   *           this.set('date.minutes', d.getMinutes());
   *           this.set('date.hours', d.getHours() % 12);
   *         }.bind(this), 1000);
   *       }
   *
   *     });
   *
   *  Allows bindings to `date` sub-fields to update on changes:
   *
   *     <x-date date="{{date}}"></x-date>
   *
   *     Hour: <span>{{date.hours}}</span>
   *     Min:  <span>{{date.minutes}}</span>
   *     Sec:  <span>{{date.seconds}}</span>
   *
   * @class data feature: path notification
   */

  (function() {
    // Using strict here to ensure fast argument manipulation in array methods
    'use strict';

    Polymer.Base._addFeature({
      /**
        Notify that a path has changed. For example:

            this.item.user.name = 'Bob';
            this.notifyPath('item.user.name', this.item.user.name);

        Returns true if notification actually took place, based on
        a dirty check of whether the new value was already known
      */
      notifyPath: function(path, value, fromAbove) {
        var old = this._propertySet(path, value);
        // manual dirty checking for now...
        if (old !== value) {
          // console.group((this.localName || this.dataHost.id + '-' + this.dataHost.dataHost.index) + '#' + (this.id || this.index) + ' ' + path, value);
          // Take path effects at this level for exact path matches,
          // and notify down for any bindings to a subset of this path
          this._pathEffector(path, value);
          // Send event to notify the path change upwards
          // Optimization: don't notify up if we know the notification
          // is coming from above already (avoid wasted event dispatch)
          if (!fromAbove) {
            // TODO(sorvell): should only notify if notify: true?
            this._notifyPath(path, value);
          }
          // console.groupEnd((this.localName || this.dataHost.id + '-' + this.dataHost.dataHost.index) + '#' + (this.id || this.index) + ' ' + path, value);
        }
      },

      /**
        Converts a path to an array of path parts.  A path may be specified
        as a dotted string or an array of one or more dotted strings (or numbers,
        for number-valued keys).
      */
      _getPathParts: function(path) {
        if (Array.isArray(path)) {
          var parts = [];
          for (var i=0; i<path.length; i++) {
            var args = path[i].toString().split('.');
            for (var j=0; j<args.length; j++) {
              parts.push(args[j]);
            }
          }
          return parts;
        } else {
          return path.toString().split('.');
        }
      },

      /**
        Convienence method for setting a value to a path and calling
        notify path (when the path is to a nested property).  If any part
        in the path except for the last is undefined, does nothing.
      */
      set: function(path, value, root) {
        var prop = root || this;
        var parts = this._getPathParts(path);
        var array;
        var last = parts[parts.length-1];
        if (parts.length > 1) {
          for (var i=0; i<parts.length-1; i++) {
            prop = prop[parts[i]];
            if (array) {
              parts[i] = Polymer.Collection.get(array).getKey(prop);
            }
            if (!prop) {
              return;
            }
            array = Array.isArray(prop) ? prop : null;
          }
          prop[last] = value;
          if (!root) {
            this.notifyPath(parts.join('.'), value);
          }
        } else {
          prop[path] = value;
        }
      },

      /**
        Convienence method for reading a value from a path.  Returns undefined
        if any part in the path is undefined.
      */
      get: function(path, root) {
        var prop = root || this;
        var parts = this._getPathParts(path);
        var last = parts.pop();
        while (parts.length) {
          prop = prop[parts.shift()];
          if (!prop) {
            return;
          }
        }
        return prop[last];
      },

      _pathEffector: function(path, value) {
        // get root property
        var model = this._modelForPath(path);
        // search property effects of the root property for 'annotation' effects
        var fx$ = this._propertyEffects[model];
        if (fx$) {
          fx$.forEach(function(fx) {
            var fxFn = this['_' + fx.kind + 'PathEffect'];
            if (fxFn) {
              fxFn.call(this, path, value, fx.effect);
            }
          }, this);
        }
        // notify runtime-bound paths
        if (this._boundPaths) {
          this._notifyBoundPaths(path, value);
        }
      },

      _annotationPathEffect: function(path, value, effect) {
        if (effect.value === path || effect.value.indexOf(path + '.') === 0) {
          // TODO(sorvell): ideally the effect function is on this prototype
          // so we don't have to call it like this.
          Polymer.Bind._annotationEffect.call(this, path, value, effect);
        } else if ((path.indexOf(effect.value + '.') === 0) && !effect.negate) {
          // locate the bound node
          var node = this._nodes[effect.index];
          if (node && node.notifyPath) {
            var p = this._fixPath(effect.name , effect.value, path);
            node.notifyPath(p, value, true);
          }
        }
      },

      _complexObserverPathEffect: function(path, value, effect) {
        if (this._pathMatchesEffect(path, effect)) {
          Polymer.Bind._complexObserverEffect.call(this, path, value, effect);
        }
      },

      _computePathEffect: function(path, value, effect) {
        if (this._pathMatchesEffect(path, effect)) {
          Polymer.Bind._computeEffect.call(this, path, value, effect);
        }
      },

      _annotatedComputationPathEffect: function(path, value, effect) {
        if (this._pathMatchesEffect(path, effect)) {
          Polymer.Bind._annotatedComputationEffect.call(this, path, value, effect);
        }
      },

      _pathMatchesEffect: function(path, effect) {
        var effectArg = effect.arg.name;
        return (effectArg == path) ||
          (effectArg.indexOf(path + '.') === 0) ||
          (effect.arg.wildcard && path.indexOf(effectArg) === 0);
      },

      linkPaths: function(to, from) {
        this._boundPaths = this._boundPaths || {};
        if (from) {
          this._boundPaths[to] = from;
          // this.set(to, this.get(from));
        } else {
          this.unbindPath(to);
          // this.set(to, from);
        }
      },

      unlinkPaths: function(path) {
        if (this._boundPaths) {
          delete this._boundPaths[path];
        }
      },

      _notifyBoundPaths: function(path, value) {
        var from, to;
        for (var a in this._boundPaths) {
          var b = this._boundPaths[a];
          if (path.indexOf(a + '.') == 0) {
            from = a;
            to = b;
            break;
          }
          if (path.indexOf(b + '.') == 0) {
            from = b;
            to = a;
            break;
          }
        }
        if (from && to) {
          var p = this._fixPath(to, from, path);
          this.notifyPath(p, value);
        }
      },

      _fixPath: function(property, root, path) {
        return property + path.slice(root.length);
      },

      _notifyPath: function(path, value) {
        var rootName = this._modelForPath(path);
        var dashCaseName = Polymer.CaseMap.camelToDashCase(rootName);
        var eventName = dashCaseName + this._EVENT_CHANGED;
        this.fire(eventName, {
          path: path,
          value: value
        }, {bubbles: false});
      },

      _modelForPath: function(path) {
        return path.split('.').shift();
      },

      _EVENT_CHANGED: '-changed',

      _notifySplice: function(array, path, index, added, removed) {
        var splices = [{
          index: index,
          addedCount: added,
          removed: removed,
          object: array,
          type: 'splice'
        }];
        this.notifyPath(path + '.splices', {
          keySplices: Polymer.Collection.get(array).applySplices(splices),
          indexSplices: splices
        });
      },

      /**
       * Adds items onto the end of the array at the path specified.
       *
       * The arguments after `path` and return value match that of
       * `Array.prototype.push`.
       *
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       *
       * @method push
       * @param {String} path Path to array.
       * @param {...any} var_args Items to push onto array
       * @return {number} New length of the array.
       */
      push: function(path) {
        var array = this.get(path);
        var args = Array.prototype.slice.call(arguments, 1);
        var len = array.length;
        var ret = array.push.apply(array, args);
        this._notifySplice(array, path, len, args.length, []);
        return ret;
      },

      /**
       * Removes an item from the end of array at the path specified.
       *
       * The arguments after `path` and return value match that of
       * `Array.prototype.pop`.
       *
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       *
       * @method pop
       * @param {String} path Path to array.
       * @return {any} Item that was removed.
       */
      pop: function(path) {
        var array = this.get(path);
        var args = Array.prototype.slice.call(arguments, 1);
        var rem = array.slice(-1);
        var ret = array.pop.apply(array, args);
        this._notifySplice(array, path, array.length, 0, rem);
        return ret;
      },

      /**
       * Starting from the start index specified, removes 0 or more items
       * from the array and inserts 0 or more new itms in their place.
       *
       * The arguments after `path` and return value match that of
       * `Array.prototype.splice`.
       *
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       *
       * @method splice
       * @param {String} path Path to array.
       * @param {number} start Index from which to start removing/inserting.
       * @param {number} deleteCount Number of items to remove.
       * @param {...any} var_args Items to insert into array.
       * @return {number} New length of the array.
       */
      splice: function(path, start, deleteCount) {
        var array = this.get(path);
        var args = Array.prototype.slice.call(arguments, 1);
        var rem = array.slice(start, start + deleteCount);
        var ret = array.splice.apply(array, args);
        this._notifySplice(array, path, start, args.length - 2, rem);
        return ret;
      },

      /**
       * Removes an item from the beginning of array at the path specified.
       *
       * The arguments after `path` and return value match that of
       * `Array.prototype.pop`.
       *
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       *
       * @method shift
       * @param {String} path Path to array.
       * @return {any} Item that was removed.
       */
      shift: function(path) {
        var array = this.get(path);
        var args = Array.prototype.slice.call(arguments, 1);
        var ret = array.shift.apply(array, args);
        this._notifySplice(array, path, 0, 0, [ret]);
        return ret;
      },

      /**
       * Adds items onto the beginning of the array at the path specified.
       *
       * The arguments after `path` and return value match that of
       * `Array.prototype.push`.
       *
       * This method notifies other paths to the same array that a
       * splice occurred to the array.
       *
       * @method unshift
       * @param {String} path Path to array.
       * @param {...any} var_args Items to insert info array
       * @return {number} New length of the array.
       */
      unshift: function(path) {
        var array = this.get(path);
        var args = Array.prototype.slice.call(arguments, 1);
        var ret = array.unshift.apply(array, args);
        this._notifySplice(array, path, 0, args.length, []);
        return ret;
      }

    });

  })();



;

  Polymer.Base._addFeature({

    resolveUrl: function(url) {
      // TODO(sorvell): do we want to put the module reference on the prototype?
      var module = Polymer.DomModule.import(this.is);
      var root = '';
      if (module) {
        var assetPath = module.getAttribute('assetpath') || '';
        root = Polymer.ResolveUrl.resolveUrl(assetPath, module.ownerDocument.baseURI);
      }
      return Polymer.ResolveUrl.resolveUrl(url, root);
    }

  });


;

/*
  Extremely simple css parser. Intended to be not more than what we need
  and definitely not necessarly correct =).
*/
(function() {

  // given a string of css, return a simple rule tree
  function parse(text) {
    text = clean(text);
    return parseCss(lex(text), text);
  }

  // remove stuff we don't care about that may hinder parsing
  function clean(cssText) {
    return cssText.replace(rx.comments, '').replace(rx.port, '');
  }

  // super simple {...} lexer that returns a node tree
  function lex(text) {
    var root = {start: 0, end: text.length};
    var n = root;
    for (var i=0, s=0, l=text.length; i < l; i++) {
      switch (text[i]) {
        case OPEN_BRACE:
          //console.group(i);
          if (!n.rules) {
            n.rules = [];
          }
          var p = n;
          var previous = p.rules[p.rules.length-1];
          n = {start: i+1, parent: p, previous: previous};
          p.rules.push(n);
          break;
        case CLOSE_BRACE: 
          //console.groupEnd(n.start);
          n.end = i+1;
          n = n.parent || root;
          break;
      }
    }
    return root;
  }

  // add selectors/cssText to node tree
  function parseCss(node, text) {
    var t = text.substring(node.start, node.end-1);
    node.parsedCssText = node.cssText = t.trim();
    if (node.parent) {
      var ss = node.previous ? node.previous.end : node.parent.start;
      t = text.substring(ss, node.start-1);
      // TODO(sorvell): ad hoc; make selector include only after last ;
      // helps with mixin syntax
      t = t.substring(t.lastIndexOf(';')+1);
      node.parsedSelector = node.selector = t.trim();
    }
    var r$ = node.rules;
    if (r$) {
      for (var i=0, l=r$.length, r; (i<l) && (r=r$[i]); i++) {
        parseCss(r, text);
      }  
    }
    return node;  
  }

  // stringify parsed css.
  function stringify(node, preserveProperties, text) {
    text = text || '';
    // calc rule cssText
    var cssText = '';
    if (node.cssText || node.rules) {
      var r$ = node.rules;
      if (r$ && (preserveProperties || !hasMixinRules(r$))) {
        for (var i=0, l=r$.length, r; (i<l) && (r=r$[i]); i++) {
          cssText = stringify(r, preserveProperties, cssText);
        }  
      } else {
        cssText = preserveProperties ? node.cssText : 
          removeCustomProps(node.cssText);  
        cssText = cssText.trim();
        if (cssText) {
          cssText = '  ' + cssText + '\n';
        }
      }
    }
    // emit rule iff there is cssText
    if (cssText) {
      if (node.selector) {
        text += node.selector + ' ' + OPEN_BRACE + '\n';
      }
      text += cssText;
      if (node.selector) {
        text += CLOSE_BRACE + '\n\n';
      }
    }
    return text;
  }

  var OPEN_BRACE = '{';
  var CLOSE_BRACE = '}';

  function hasMixinRules(rules) {
    return (rules[0].selector.indexOf(VAR_START) >= 0);
  }

  function removeCustomProps(cssText) {
    return cssText
      .replace(rx.customProp, '')
      .replace(rx.mixinProp, '')
      .replace(rx.mixinApply, '');
  }

  var VAR_START = '--';

  // helper regexp's
  var rx = {
    comments: /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
    port: /@import[^;]*;/gim,
    customProp: /--[^;{]*?:[^{};]*?;/gim,
    mixinProp: /--[^;{]*?:[^{;]*?{[^}]*?};?/gim,
    mixinApply: /@apply[\s]*\([^)]*?\)[\s]*;/gim
  };

  // exports 
  Polymer.CssParse = {
    parse: parse,
    stringify: stringify
  };

})();


;

  Polymer.StyleUtil = (function() {

    return {
      toCssText: function(rules, callback) {
        if (typeof rules === 'string') {
          rules = Polymer.CssParse.parse(rules);
        } 
        if (callback) {
          this.forEachStyleRule(rules, callback);
        }
        return Polymer.CssParse.stringify(rules);
      },

      forEachStyleRule: function(node, cb) {
        var s = node.selector;
        var skipRules = false;
        if (s) {
          if ((s.indexOf(this.AT_RULE) !== 0) && (s.indexOf(this.MIXIN_SELECTOR) !== 0)) {
            cb(node);
          }
          skipRules = (s.indexOf(this.KEYFRAME_RULE) >= 0) || 
            (s.indexOf(this.MIXIN_SELECTOR) >= 0);
        }
        var r$ = node.rules;
        if (r$ && !skipRules) {
          for (var i=0, l=r$.length, r; (i<l) && (r=r$[i]); i++) {
            this.forEachStyleRule(r, cb);
          }
        }
      },

      // add a string of cssText to the document.
      applyCss: function(cssText, moniker, target, lowPriority) {
        var style = document.createElement('style');
        if (moniker) {
          style.setAttribute('scope', moniker);
        }
        style.textContent = cssText;
        target = target || document.head;
        if (lowPriority) {
          var n$ = target.querySelectorAll('style[scope]');
          var ref = n$.length ? n$[n$.length-1].nextSibling : target.firstChild;
          target.insertBefore(style, ref);
       } else {
          target.appendChild(style);
        }
        return style;
      },

      AT_RULE: '@',
      KEYFRAME_RULE: 'keyframe',
      MIXIN_SELECTOR: '--',
      parser: Polymer.CssParse
    };

  })();


;

  (function() {

    /* Transforms ShadowDOM styling into ShadyDOM styling

     * scoping: 

        * elements in scope get scoping selector class="x-foo-scope"
        * selectors re-written as follows:

          div button -> div.x-foo-scope button.x-foo-scope

     * :host -> scopeName

     * :host(...) -> scopeName...

     * ::content -> ' ' NOTE: requires use of scoping selector and selectors
       cannot otherwise be scoped:
       e.g. :host ::content > .bar -> x-foo > .bar

     * ::shadow, /deep/: processed simimlar to ::content

     * :host-context(...): NOT SUPPORTED

    */

    // Given a node and scope name, add a scoping class to each node 
    // in the tree. This facilitates transforming css into scoped rules. 
    function transformDom(node, scope, useAttr, shouldRemoveScope) {
      _transformDom(node, scope || '', useAttr, shouldRemoveScope);
    }

    function _transformDom(node, selector, useAttr, shouldRemoveScope) {
      if (node.setAttribute) {
        transformElement(node, selector, useAttr, shouldRemoveScope);
      }
      var c$ = Polymer.dom(node).childNodes;
      for (var i=0; i<c$.length; i++) {
        _transformDom(c$[i], selector, useAttr, shouldRemoveScope);
      }
    }

    function transformElement(element, scope, useAttr, shouldRemoveScope) {
      if (useAttr) {
        if (shouldRemoveScope) {
          element.removeAttribute(SCOPE_NAME);
        } else {
          element.setAttribute(SCOPE_NAME, scope);
        }
      } else {
        // note: if using classes, we add both the general 'style-scope' class
        // as well as the specific scope. This enables easy filtering of all
        // `style-scope` elements
        if (scope) {
          if (shouldRemoveScope) {
            element.classList.remove(SCOPE_NAME);
            element.classList.remove(scope);
          } else {
            element.classList.add(SCOPE_NAME);
            element.classList.add(scope);
          }
        }
      }
    }

    function transformHost(host, scope) {
    }

    // Given a string of cssText and a scoping string (scope), returns
    // a string of scoped css where each selector is transformed to include
    // a class created from the scope. ShadowDOM selectors are also transformed
    // (e.g. :host) to use the scoping selector.
    function transformCss(rules, scope, ext, callback, useAttr) {
      var hostScope = calcHostScope(scope, ext);
      scope = calcElementScope(scope, useAttr);
      return Polymer.StyleUtil.toCssText(rules, function(rule) {
        if (!rule.isScoped) {
          transformRule(rule, scope, hostScope);
          rule.isScoped = true;
        }
        if (callback) {
          callback(rule, scope, hostScope);
        }
      });
    }

    function calcElementScope(scope, useAttr) {
      if (scope) {
        return useAttr ?
          CSS_ATTR_PREFIX + scope + CSS_ATTR_SUFFIX :
          CSS_CLASS_PREFIX + scope;
      } else {
        return '';
      }
    }

    function calcHostScope(scope, ext) {
      return ext ? '[is=' +  scope + ']' : scope;
    }

    function transformRule(rule, scope, hostScope) {
      _transformRule(rule, transformComplexSelector,
        scope, hostScope);
    }

    // transforms a css rule to a scoped rule.
    function _transformRule(rule, transformer, scope, hostScope) {
      var p$ = rule.selector.split(COMPLEX_SELECTOR_SEP);
      for (var i=0, l=p$.length, p; (i<l) && (p=p$[i]); i++) {
        p$[i] = transformer(p, scope, hostScope);
      }
      rule.selector = p$.join(COMPLEX_SELECTOR_SEP);
    }

    function transformComplexSelector(selector, scope, hostScope) {
      var stop = false;
      selector = selector.replace(SIMPLE_SELECTOR_SEP, function(m, c, s) {
        if (!stop) {
          var o = transformCompoundSelector(s, c, scope, hostScope);
          if (o.stop) {
            stop = true;
          }
          c = o.combinator;
          s = o.value;  
        }
        return c + s;
      });
      return selector;
    }

    function transformCompoundSelector(selector, combinator, scope, hostScope) {
      // replace :host with host scoping class
      var jumpIndex = selector.search(SCOPE_JUMP);
      if (selector.indexOf(HOST) >=0) {
        // :host(...)
        selector = selector.replace(HOST_PAREN, function(m, host, paren) {
          return hostScope + paren;
        });
        // now normal :host
        selector = selector.replace(HOST, hostScope);
      // replace other selectors with scoping class
      } else if (jumpIndex !== 0) {
        selector = scope ? transformSimpleSelector(selector, scope) : selector;
      }
      // remove left-side combinator when dealing with ::content.
      if (selector.indexOf(CONTENT) >= 0) {
        combinator = '';
      }
      // process scope jumping selectors up to the scope jump and then stop
      // e.g. .zonk ::content > .foo ==> .zonk.scope > .foo
      var stop;
      if (jumpIndex >= 0) {
        selector = selector.replace(SCOPE_JUMP, ' ');
        stop = true;
      }
      return {value: selector, combinator: combinator, stop: stop};
    }

    function transformSimpleSelector(selector, scope) {
      var p$ = selector.split(PSEUDO_PREFIX);
      p$[0] += scope;
      return p$.join(PSEUDO_PREFIX);
    }

    function transformRootRule(rule) {
      _transformRule(rule, transformRootSelector);
    }

    function transformRootSelector(selector) {
      return selector.match(SCOPE_JUMP) ?
        transformComplexSelector(selector) :
        selector.trim() + SCOPE_ROOT_SELECTOR;
    }

    var SCOPE_NAME = 'style-scope';
    var SCOPE_ROOT_SELECTOR = ':not([' + SCOPE_NAME + '])' + 
      ':not(.' + SCOPE_NAME + ')';
    var COMPLEX_SELECTOR_SEP = ',';
    var SIMPLE_SELECTOR_SEP = /(^|[\s>+~]+)([^\s>+~]+)/g;
    var HOST = ':host';
    // NOTE: this supports 1 nested () pair for things like 
    // :host(:not([selected]), more general support requires
    // parsing which seems like overkill
    var HOST_PAREN = /(\:host)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/g;
    var CONTENT = '::content';
    var SCOPE_JUMP = /\:\:content|\:\:shadow|\/deep\//;
    var CSS_CLASS_PREFIX = '.';
    var CSS_ATTR_PREFIX = '[' + SCOPE_NAME + '~=';
    var CSS_ATTR_SUFFIX = ']';
    var PSEUDO_PREFIX = ':';

    // exports
    Polymer.StyleTransformer = {
      element: transformElement,
      dom: transformDom,
      host: transformHost,
      css: transformCss,
      rule: transformRule,
      rootRule: transformRootRule,
      SCOPE_NAME: SCOPE_NAME
    };

  })();


;

  (function() {

    var prepTemplate = Polymer.Base._prepTemplate;
    var prepElement = Polymer.Base._prepElement;
    var baseStampTemplate = Polymer.Base._stampTemplate;
    var nativeShadow = Polymer.Settings.useNativeShadow;

    Polymer.Base._addFeature({

      // declaration-y
      _prepTemplate: function() {
        prepTemplate.call(this);
        // scope css
        this._styles = this._prepareStyles();
        var cssText = this._transformStyles(this._styles);
        if (this._encapsulateStyle === undefined) {
          this._encapsulateStyle = !nativeShadow && 
            Boolean(this._template);
        }
        if (cssText && this._template) {
          Polymer.StyleUtil.applyCss(cssText, this.is, 
            nativeShadow ? this._template.content : null, true);
        }
      },

      _prepElement: function(element) {
        if (this._encapsulateStyle) {
          Polymer.StyleTransformer.element(element, this.is,
            this._scopeCssViaAttr);
        }
        prepElement.call(this, element);
      },

      // search for extra style modules via `styleModules`
      // TODO(sorvell): consider dropping support for `styleModules`
      _prepareStyles: function() {
        var cssText = '', m$ = this.styleModules;
        if (m$) {
          for (var i=0, l=m$.length, m; (i<l) && (m=m$[i]); i++) {
            cssText += this._cssFromModule(m);
          }
        }
        cssText += this._cssFromModule(this.is);
        var styles = [];
        if (cssText) {
          var s = document.createElement('style');
          s.textContent = cssText;  
          styles.push(s);
        }
        return styles;
      },

      // returns cssText of styles in a given module; also un-applies any
      // styles that apply to the document.
      _cssFromModule: function(moduleId) {
        var m = Polymer.DomModule.import(moduleId);
        if (m && !m._cssText) {
          var cssText = '';
          var e$ = Array.prototype.slice.call(
            m.querySelectorAll(STYLES_SELECTOR));
          for (var i=0, e; i < e$.length; i++) {
            e = e$[i];
            // style elements inside dom-modules will apply to the main document
            // we don't want this, so we remove them here.
            if (e.localName === 'style') {
              // get style element applied to main doc via HTMLImports polyfill
              e = e.__appliedElement || e;
              e.parentNode.removeChild(e);
            // it's an import, assume this is a text file of css content.
            } else {
              e = e.import && e.import.body;
            }
            // adjust paths in css.
            if (e) {
              cssText += 
                Polymer.ResolveUrl.resolveCss(e.textContent, e.ownerDocument);
            }
          }
          m._cssText = cssText;
        }
        return m && m._cssText || '';
      },

      _transformStyles: function(styles, callback) {
        var cssText = '';
        for (var i=0, l=styles.length, s, text; (i<l) && (s=styles[i]); i++) {
          var rules = this._rulesForStyle(s);
          cssText += nativeShadow ?
            Polymer.StyleUtil.toCssText(rules, callback) :
            Polymer.StyleTransformer.css(rules, this.is, this.extends, callback,
            this._scopeCssViaAttr) + '\n\n';
        }
        return cssText.trim();
      },

      _rulesForStyle: function(style) {
        if (!style.__cssRules) {
          style.__cssRules = Polymer.StyleUtil.parser.parse(style.textContent);
        }
        return style.__cssRules;
      },

      _forRulesInStyles: function(styles, cb) {
        if (styles) {
          for (var i=0, l=styles.length, s; (i<l) && (s=styles[i]); i++) {
            Polymer.StyleUtil.forEachStyleRule(this._rulesForStyle(s), cb);
          }
        }
      },

      // instance-y
      _stampTemplate: function() {
        if (this._encapsulateStyle) {
          Polymer.StyleTransformer.host(this, this.is);
        }
        baseStampTemplate.call(this);
      },

      // add scoping class whenever an element is added to localDOM
      _elementAdd: function(node) {
        if (this._encapsulateStyle && !node.__styleScoped) {
          Polymer.StyleTransformer.dom(node, this.is, this._scopeCssViaAttr);
        }
      },

      // remove scoping class whenever an element is removed from localDOM
      _elementRemove: function(node) {
        if (this._encapsulateStyle) {
          Polymer.StyleTransformer.dom(node, this.is, this._scopeCssViaAttr, true);
        }
      },

      /**
       * Apply style scoping to the specified `container` and all its 
       * descendants. If `shoudlObserve` is true, changes to the container are
       * monitored via mutation observer and scoping is applied.
       */
      scopeSubtree: function(container, shouldObserve) {
        if (nativeShadow) {
          return;
        }
        var self = this;
        var scopify = function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            node.className = self._scopeElementClass(node, node.className);
            var n$ = node.querySelectorAll('*');
            Array.prototype.forEach.call(n$, function(n) {
              n.className = self._scopeElementClass(n, n.className);
            });
          }
        };
        scopify(container);
        if (shouldObserve) {
          var mo = new MutationObserver(function(mxns) {
            mxns.forEach(function(m) {
              if (m.addedNodes) {
                for (var i=0; i < m.addedNodes.length; i++) {
                  scopify(m.addedNodes[i]);
                }
              }
            });
          });
          mo.observe(container, {childList: true, subtree: true});
          return mo;
        }
      }

    });

    var STYLES_SELECTOR = 'style, link[rel=import][type~=css]';

  })();


;

  Polymer.StyleProperties = (function() {

    var nativeShadow = Polymer.Settings.useNativeShadow;

    return {

      // decorate rules with property info: whether it produces or consumes them
      decorateRules: function(rules) {
        if (rules.properties) {
          return;
        }
        var pp = {};
        var self = this;
        Polymer.StyleUtil.forEachStyleRule(rules, function(rule) {
          var p = self.decorateRule(rule);
          pp.consumes = pp.consumes || p.consumes;
          pp.produces = pp.produces || p.produces;
        });
        rules.properties = pp;
      },

      // decorate a single rule with property info
      decorateRule: function(rule) {
        if (rule.properties) {
          return;
        }
        var cssText = rule.parsedCssText;
        var rx = this.rx;
        // NOTE: we support consumption inside mixin assignment
        // but not production, so strip out {...}
        var cleanCss = cssText.replace(rx.BRACKETED, '');
        var p = rule.properties = {
          produces: cssText.match(rx.VAR_ASSIGN),
          consumes: cleanCss.match(rx.VAR_USE) || cleanCss.match(rx.MIXIN_USE)
        };
        // TODO(sorvell): workaround parser seeing mixins as additional rules
        if (p.produces) {
          rule.rules = null;
        }
        return p;
      },

      // collects the custom properties from a rule's cssText
      collect: function(rule, properties) {
        if (rule.properties.produces) {
          var m, rx = this.rx.VAR_ASSIGN;
          // cssText may be modified but in this case
          // raw version is saved for processing
          var cssText = rule.parsedCssText;
          while (m = rx.exec(cssText)) {
            // note: group 2 is var, 3 is mixin
            properties[m[1]] = (m[2] || m[3]).trim();
          }
        }
      },

      // turns custom properties into realized values.
      reify: function(props) {
        for (var i in props) {
          props[i] = this.valueForProperty(props[i], props);
        }
      },

      // given a property value, returns the reified value
      // a property value may be:
      // (1) a literal value like: red or 5px;
      // (2) a variable value like: var(--a), var(--a, red), or var(--a, --b);
      // (3) a literal mixin value like { properties }. Each of these properties
      // can have values that are: (a) literal, (b) variables, (c) @apply mixins.
      valueForProperty: function(property, props) {
        // case (1) default
        // case (3) defines a mixin and we have to reify the internals
        if (property && property.indexOf(';') >=0) {
          property = this.valueForMixin(property, props);
        } else {
          // case (2) variable
          var m = property && property.match(this.rx.VAR_VALUE);
          if (m) {
            var value = m[1], def = m[2];
            property = this.valueForProperty(props[value], props) ||
              (props[def] ? this.valueForProperty(props[def], props) : def);
          }
        }
        return property && property.trim();
      },
      
      // note: we do not yet support mixin within mixin
      valueForMixin: function(property, props) {
        var parts = property.split(';');
        for (var i=0, p, m; (i<parts.length) && (p=parts[i]); i++) {
          m = p.match(this.rx.MIXIN_MATCH);
          if (m) {
            p = this.valueForProperty(props[m[1]], props);
          } else {
            var pp = p.split(':');
            if (pp[1]) {
              pp[1] = pp[1].trim();
              pp[1] = this.valueForProperty(pp[1], props) || pp[1];
            }
            p = pp.join(': ');
          }
          parts[i] = (p && p.lastIndexOf(';') === p.length - 1) ? 
            // strip trailing ;
            p.slice(0, -1) :
            p || '';
        }
        return parts.join(';');
      },

      // TODO(srovell): make this go away by pre-processing rules
      // to contain specifically only the css that consumes properties 
      // for use here.
      //
      // returns cssText with properties applied;
      // if no properties apply, returns nothing
      applyProperties: function(rule, props) {
        var cssText = rule.parsedCssText;
        var output = '';
        // dynamically added sheets may not be decorated so ensure they are.
        if (!rule.properties) {
          this.decorateRule(rule);
        }
        if (rule.properties.consumes) {
          var m, v;
          // cssText including {...} will confuse this function so we lim it
          cssText = cssText.replace(this.rx.BRACKETED, '');
          // e.g. color: var(--color);
          while (m = this.rx.VAR_USE.exec(cssText)) {
            v = this.valueForProperty(m[2], props);
            if (v) {
              output += '\t' + m[1].trim() + ': ' + this.propertyToCss(v);
            }
          }
          // e.g. @apply(--stuff);
          while (m = this.rx.MIXIN_USE.exec(cssText)) {
            v = m[1];
            if (v) {
              var parts = v.split(' ');
              for (var i=0, p; i < parts.length; i++) {
                p = props[parts[i].trim()];
                if (p) {
                  output += '\t' + this.propertyToCss(p);
                }
              }
            }
          }
        }
        rule.cssText = output;
      },

      propertyToCss: function(property) {
        var p = property.trim();
        p = p[p.length-1] === ';' ? p : p + ';';
        return p + '\n';
      },

      rx: {
        VAR_ASSIGN: /(?:^|;\s*)(--[^\:;]*?):\s*?(?:([^;{]*?)|{([^}]*)})(?=;)/gim,
        VAR_VALUE: /^var\([\s]*([^,)]*)[\s]*,?[\s]*([^,)]*)[\s]*?\);?/,
        VAR_USE: /(?:^|[;}\s])([^;{}]*?):[\s]*?(var\([^)]*?\))/gim,
        MIXIN_USE: /@apply\(([^)]*)\);?/gim, 
        MIXIN_MATCH: /@apply\(([^)]*)\);?/im, 
        BRACKETED: /\{[^}]*\}/g
      }
    };


  })();


;

  (function() {
    
    var style = document.createElement('style'); 
    var properties;

    function applyCss(cssText) {
      style.textContent += cssText;
      properties = null;
      // TODO(sorvell): make this lazy at the point of consumption
      // or better yet, pass in pre-parsed rules here.
      style.__cssRules =
        Polymer.StyleUtil.parser.parse(style.textContent);
      Polymer.StyleProperties.decorateRules(style.__cssRules);
    }

    function getProperties() {
      if (!properties) {
        properties = {};
        Polymer.StyleUtil.forEachStyleRule(style.__cssRules, 
          function(rule) {
            Polymer.Base._rootCustomPropertiesFromRule(properties, rule);
        });
        Polymer.StyleProperties.reify(properties);
      }
      return properties;
    }

    applyCss('');

    // exports
    Polymer.StyleDefaults = {
      applyCss: applyCss,
      style: style,
      styles: [style],
      getProperties: getProperties
    };

  })();

;
  (function() {

    var baseAttachedCallback = Polymer.Base.attachedCallback;
    var baseSerializeValueToAttribute = Polymer.Base.serializeValueToAttribute;
    var prepTemplate = Polymer.Base._prepTemplate;

    var propertyUtils = Polymer.StyleProperties;

    var nativeShadow = Polymer.Settings.useNativeShadow;

    Polymer.Base._addFeature({

      // TODO(sorvell): consider tracking which rules have properties so that
      // instances can skip those that don't.
      _prepTemplate: function() {
        prepTemplate.call(this);
        // determine if element contains x-scope styling
        var consumes;
        if (this._styles) {
          this._styles.forEach(function(s) {
            var rules = this._rulesForStyle(s);
            propertyUtils.decorateRules(rules);
            if (rules.properties.consumes) {
              consumes = true;
            }
          }, this);
        }
        this._usesStyleProperties = consumes;
      },

      attachedCallback: function() {
        baseAttachedCallback.call(this);
        // note: do this once automatically,
        // then requires calling `updateStyles`
        if (!this._xScopeSelector) {
          this._updateOwnStyles();
        }
      },

      _updateOwnStyles: function() {
        if (this._usesStyleProperties) {
          this._styleProperties = this._computeStyleProperties();
          this._applyStyleProperties(this._styleProperties);
        }
      },

      _computeStyleProperties: function() {
        var props = {};
        // properties come from host/defaults
        this.mixin(props, this._computeScopeStyleProperties());
        this.mixin(props, this._computeOwnStyleProperties());
        propertyUtils.reify(props);
        return props;
      },

      _computeScopeStyleProperties: function() {
        var host = this.domHost;
        // ensure host has styleProperties
        if (host && !host._styleProperties) {
          host._styleProperties = host._computeStyleProperties();
        }
        // get props and styles from host or defaults
        var styles = host ? host._styles : Polymer.StyleDefaults.styles;
        var props = Object.create(host ? host._styleProperties :
          Polymer.StyleDefaults.getProperties());
        // now match this element in these styles and add those properties
        var cb = this._elementCustomPropertiesFromRule.bind(this, props, this);
        this._forRulesInStyles(styles, cb);
        return props;
      },

      _computeOwnStyleProperties: function() {
        var props = {};
        var cb = this._rootCustomPropertiesFromRule.bind(this, props);
        this._forRulesInStyles(this._styles, cb);
        return props;
      },

      // Test if a rule matches the given `element` and if so,
      // collect any custom properties into `props`.
      _elementCustomPropertiesFromRule: function(props, element, rule) {
        if (element && this.elementMatches(rule.selector, element)) {
          propertyUtils.collect(rule, props);
        }
      },

      // TODO(sorvell): optimization, this collection could
      // be done at prototype time!
      //
      // Test if a rule matches root crteria (:host or :root) and if so,
      // collect any custom properties into `props`.
      // these rules may already be shimmed and it's $ to reparse,
      // so we check `is` value as a fallback
      _rootCustomPropertiesFromRule: function(props, rule) {
        var s = rule.parsedSelector;
        if (s === HOST || s === ROOT) {
          propertyUtils.collect(rule, props);
        }
      },

      // apply styles
      _applyStyleProperties: function(bag) {
        var s$ = this._styles;
        if (s$) {
          var style = styleFromCache(this.is, bag, s$);
          var old = this._xScopeSelector;
          this._ensureScopeSelector(style ? style._scope : null);
          if (!style) {
            var cb = this._applyPropertiesToRule.bind(this, bag);
            var cssText = this._transformStyles(s$, cb);
            style = cssText ? this._applyCustomCss(cssText) : {};
            cacheStyle(this.is, style, this._xScopeSelector,
              this._styleProperties, s$);
          } else if (nativeShadow) {
            this._applyCustomCss(style.textContent);
          }
          if (style.textContent || old /*&& !nativeShadow*/) {
            this._applyXScopeSelector(this._xScopeSelector, old);
          }
        }
      },

      _applyPropertiesToRule: function(properties, rule) {
        propertyUtils.applyProperties(rule, properties);
        if (rule.cssText && !nativeShadow) {
          this._scopifyRule(rule);
        }
      },

      // Strategy: x scope shim a selector e.g. to scope `.x-foo-42` (via classes):
      // non-host selector: .a.x-foo -> .x-foo-42 .a.x-foo
      // host selector: x-foo.wide -> x-foo.x-foo-42.wide
      _scopifyRule: function(rule) {
        rule.transformedSelector = rule.transformedSelector || rule.selector;
        var selector = rule.transformedSelector;
        var host = this.is;
        var rx = new RegExp(HOST_SELECTOR_PREFIX + host + HOST_SELECTOR_SUFFIX);
        var parts = selector.split(',');
        var scope = this._scopeCssViaAttr ?
          SCOPE_PREFIX + this._xScopeSelector + SCOPE_SUFFIX :
          '.' + this._xScopeSelector;
        for (var i=0, l=parts.length, p; (i<l) && (p=parts[i]); i++) {
          parts[i] = p.match(rx) ?
            p.replace(host, host + scope) :
            scope + ' ' + p;
        }
        rule.selector = parts.join(',');
      },

      _applyXScopeSelector: function(selector, old) {
        var c = this._scopeCssViaAttr ? this.getAttribute(SCOPE_NAME) :
          this.className;
        v = old ? c.replace(old, selector) :
          (c ? c + ' ' : '') + XSCOPE_NAME + ' ' + selector;
        if (c !== v) {
          if (this._scopeCssViaAttr) {
            this.setAttribute(SCOPE_NAME, v);
          } else {
            this.className = v;
          }
        }
      },

      _xScopeCount: 0,

      _ensureScopeSelector: function(selector) {
        selector = selector || (this.is + '-' +
          (this.__proto__._xScopeCount++));
        this._xScopeSelector = selector;
      },

      _applyCustomCss: function(cssText) {
        if (this._customStyle) {
          this._customStyle.textContent = cssText;
        } else if (cssText) {
          this._customStyle = Polymer.StyleUtil.applyCss(cssText,
            this._xScopeSelector,
            nativeShadow ? this.root : null);
        }
        return this._customStyle;
      },

      _scopeElementClass: function(element, selector) {
        if (!nativeShadow && !this._scopeCssViaAttr) {
          selector += (selector ? ' ' : '') + SCOPE_NAME + ' ' + this.is +
            (element._xScopeSelector ? ' ' +  XSCOPE_NAME + ' ' +
            element._xScopeSelector : '');
        }
        return selector;
      },

      // override to ensure whenever classes are set, we need to shim them.
      serializeValueToAttribute: function(value, attribute, node) {
        if (attribute === 'class') {
          // host needed to scope styling.
          var host = node === this ?
            Polymer.dom(this).getOwnerRoot() || this.dataHost :
            this;
          if (host) {
            value = host._scopeElementClass(node, value);
          }
        }
        baseSerializeValueToAttribute.call(this, value, attribute, node);
      },

      updateStyles: function() {
        this._updateOwnStyles();
        this._updateRootStyles(this.root);
      },

      updateHostStyles: function() {
        var host = Polymer.dom(this).getOwnerRoot() || this.dataHost;
        if (host) {
          host.updateStyles();
        } else {
          this._updateRootStyles(document);
        }
      },

      _updateRootStyles: function(root) {
        root = root || this.root;
        var c$ = Polymer.dom(root)._query(function(e) {
          return e.shadyRoot || e.shadowRoot;
        });
        for (var i=0, l= c$.length, c; (i<l) && (c=c$[i]); i++) {
          if (c.updateStyles) {
            c.updateStyles();
          }
        }
      }

    });

    /**
     * Force all custom elements using cross scope custom properties,
     * to update styling.
     */
    Polymer.updateStyles = function() {
      Polymer.Base._updateRootStyles(document);
    };

    var styleCache = {};
    function cacheStyle(is, style, scope, bag, styles) {
      style._scope = scope;
      style._properties = bag;
      style._styles = styles;
      var s$ = styleCache[is] = styleCache[is] || [];
      s$.push(style);
    }

    function styleFromCache(is, bag, checkStyles) {
      var styles = styleCache[is];
      if (styles) {
        for (var i=0, s; i < styles.length; i++) {
          s = styles[i];
          if (objectsEqual(bag, s._properties) &&
            objectsEqual(checkStyles,  s._styles)) {
            return s;
          }
        }
      }
    }

    function objectsEqual(a, b) {
      for (var i in a) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      for (var i in b) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }

    var HOST = ':host';
    var ROOT = ':root';
    var SCOPE_NAME= Polymer.StyleTransformer.SCOPE_NAME;
    var XSCOPE_NAME = 'x-scope';
    var SCOPE_PREFIX = '[' + SCOPE_NAME + '~=';
    var SCOPE_SUFFIX = ']';
    var HOST_SELECTOR_PREFIX = '(?:^|[^.])';
    var HOST_SELECTOR_SUFFIX = '($|[.:[\\s>+~])';

  })();

;

  Polymer.Base._addFeature({

    _registerFeatures: function() {
      // identity
      this._prepIs();
      // inheritance
      this._prepExtends();
      // factory
      this._prepConstructor();
      // template
      this._prepTemplate();
      // template markup
      this._prepAnnotations();
      // accessors
      this._prepEffects();
      // shared behaviors
      this._prepBehaviors();
      // accessors part 2
      this._prepBindings();
      // dom encapsulation
      this._prepShady();
    },

    _prepBehavior: function(b) {
      this._addPropertyEffects(b.properties || b.accessors);
      this._addComplexObserverEffects(b.observers);
    },

    _initFeatures: function() {
      // manage local dom
      this._poolContent();
      // manage configuration
      this._setupConfigure();
      // host stack
      this._pushHost();
      // instantiate template
      this._stampTemplate();
      // host stack
      this._popHost();
      // concretize template references
      this._marshalAnnotationReferences();
      // setup debouncers
      this._setupDebouncers();
      // concretize effects on instance
      this._marshalInstanceEffects();
      // acquire instance behaviors
      this._marshalBehaviors();
      // acquire initial instance attribute values
      this._marshalAttributes();
      // top-down initial distribution, configuration, & ready callback
      this._tryReady();
    },

    _marshalBehavior: function(b) {
      // publish attributes to instance
      this._installHostAttributes(b.hostAttributes);
      // establish listeners on instance
      this._listenListeners(b.listeners);
    }

  });


;
(function() {

  var nativeShadow = Polymer.Settings.useNativeShadow;
  var propertyUtils = Polymer.StyleProperties;

  Polymer({

    is: 'custom-style',
    extends: 'style',

    created: function() {
      this._appliesToDocument = (this.parentNode.localName !== 'dom-module');
      if (this._appliesToDocument) {
        // used applied element from HTMLImports polyfill or this
        var e = this.__appliedElement || this;
        this.__cssRules = Polymer.StyleUtil.parser.parse(e.textContent);
        propertyUtils.decorateRules(this.__cssRules);
        this._rulesToDefaultProperties(this.__cssRules);
        // NOTE: go async to give a chance to collect properties into 
        // the StyleDefaults before applying
        this.async(this._applyStyle);
      }
    },

    // polyfill this style with root scoping and 
    // apply custom properties!
    _applyStyle: function() {
      // used applied element from HTMLImports polyfill or this
      var e = this.__appliedElement || this;
      var props = this._styleProperties = this._computeStyleProperties();
      var self = this;
      e.textContent = Polymer.StyleUtil.toCssText(this.__cssRules, 
        function(rule) {
          // polyfill lack of support for :root
          if (rule.selector === ':root') {
            rule.selector = 'body';
          }
          var css = rule.cssText = rule.parsedCssText;
          if (rule.properties.consumes) {
            // TODO(sorvell): factor better
            // remove property assignments so next function isn't confused
            css = css.replace(propertyUtils.rx.VAR_ASSIGN, '');
            // replace with reified properties, scenario is same as mixin
            rule.cssText = propertyUtils.valueForMixin(css, props);
          }
          if (!nativeShadow) {
            Polymer.StyleTransformer.rootRule(rule);
          }
        });
    },

    _rulesToDefaultProperties: function(rules) {
      // produce css containing only property assignments.
      Polymer.StyleUtil.forEachStyleRule(rules, function(rule) {
        if (!rule.properties.produces) {
          rule.cssText = '';
        }
      });
      // tell parser to emit css that includes properties.
      var cssText = Polymer.StyleUtil.parser.stringify(rules, true);
      if (cssText) {
        Polymer.StyleDefaults.applyCss(cssText);
      }
    }

  });

})();

;

  Polymer({

    is: 'dom-bind',

    extends: 'template',

    _registerFeatures: function() {
      this._prepExtends();
      this._prepConstructor();
    },

    _finishDistribute: function() {
      var parentDom = Polymer.dom(Polymer.dom(this).parentNode);
      parentDom.insertBefore(this.root, this);
    },

    _initFeatures: function() {
      this._template = this;
      this._prepAnnotations();
      this._prepEffects();
      this._prepBehaviors();
      this._prepBindings();
      Polymer.Base._initFeatures.call(this);
    }

  });


;

  Polymer.Templatizer = {

    properties: {
      _hideTemplateChildren: {
        observer: '_hideTemplateChildrenChanged'
      }
    },

    // Intentionally static object
    _templatizerStatic: {
      count: 0,
      callbacks: {},
      debouncer: null
    },

    // Extension point for overrides
    _instanceProps: Polymer.nob,

    created: function() {
      // id used for consolidated debouncer
      this._templatizerId = this._templatizerStatic.count++;
    },

    templatize: function(template) {
      // TODO(sjmiles): supply _alternate_ content reference missing from root
      // templates (not nested). `_content` exists to provide content sharing
      // for nested templates.
      if (!template._content) {
        template._content = template.content;
      }
      // fast path if template's anonymous class has been memoized
      if (template._content._ctor) {
        this.ctor = template._content._ctor;
        //console.log('Templatizer.templatize: using memoized archetype');
        // forward parent properties to archetype
        this._prepParentProperties(this.ctor.prototype, template);
        return;
      }
      // `archetype` is the prototype of the anonymous
      // class created by the templatizer
      var archetype = Object.create(Polymer.Base);
      // normally Annotations.parseAnnotations(template) but
      // archetypes do special caching
      this._customPrepAnnotations(archetype, template);

      // setup accessors
      archetype._prepEffects();
      this._customPrepEffects(archetype);
      archetype._prepBehaviors();
      archetype._prepBindings();

      // forward parent properties to archetype
      this._prepParentProperties(archetype, template);

      // boilerplate code
      archetype._notifyPath = this._notifyPathImpl;
      archetype._scopeElementClass = this._scopeElementClassImpl;
      archetype.listen = this._listenImpl;
      // boilerplate code
      var _constructor = this._constructorImpl;
      var ctor = function TemplateInstance(model, host) {
        _constructor.call(this, model, host);
      };
      // standard references
      ctor.prototype = archetype;
      archetype.constructor = ctor;
      // TODO(sjmiles): constructor cache?
      template._content._ctor = ctor;
      // TODO(sjmiles): choose less general name
      this.ctor = ctor;
    },

    _getRootDataHost: function() {
      return (this.dataHost && this.dataHost._rootDataHost) || this.dataHost;
    },

    _hideTemplateChildrenChanged: function(hidden) {
      if (this._hideChildren) {
        // Extension point for Templatizer sub-classes
        // TODO(kschaaf): remove once element protos can override behaviors
        this._hideChildren(hidden);
      }
    },

    _debounceTemplate: function(fn) {
      this._templatizerStatic.callbacks[this._templatizerId] = fn.bind(this);
      this._templatizerStatic.debouncer =
        Polymer.Debounce(this._templatizerStatic.debouncer,
          this._flushTemplates.bind(this, true));
    },

    _flushTemplates: function(debouncerExpired) {
      var db = this._templatizerStatic.debouncer;
      // completely flush any re-queued callbacks resulting from stamping
      while (debouncerExpired || (db && db.finish)) {
        db.stop();
        var cbs = this._templatizerStatic.callbacks;
        this._templatizerStatic.callbacks = {};
        for (var id in cbs) {
          cbs[id]();
        }
        debouncerExpired = false;
      }
    },

    _customPrepEffects: function(archetype) {
      var parentProps = archetype._parentProps;
      for (var prop in parentProps) {
        archetype._addPropertyEffect(prop, 'function',
          this._createHostPropEffector(prop));
      }
    },

    _customPrepAnnotations: function(archetype, template) {
      if (template) {
        archetype._template = template;
        var c = template._content;
        if (c) {
          var rootDataHost = archetype._rootDataHost;
          if (rootDataHost) {
            Polymer.Annotations.prepElement =
              rootDataHost._prepElement.bind(rootDataHost);
          }
          archetype._notes = c._notes ||
            Polymer.Annotations.parseAnnotations(template);
          c._notes = archetype._notes;
          Polymer.Annotations.prepElement = null;
          archetype._parentProps = c._parentProps;
        }
        else {
          console.warn('no _content');
        }
      }
      else {
        console.warn('no _template');
      }
    },

    // Sets up accessors on the template to call abstract _forwardParentProp
    // API that should be implemented by Templatizer users to get parent
    // properties to their template instances.  These accessors are memoized
    // on the archetype and copied to instances.
    _prepParentProperties: function(archetype, template) {
      var parentProps = this._parentProps = archetype._parentProps;
      if (this._forwardParentProp && parentProps) {
        // Prototype setup (memoized on archetype)
        var proto = archetype._parentPropProto;
        var prop;
        if (!proto) {
          for (prop in this._instanceProps) {
            delete parentProps[prop];
          }
          proto = archetype._parentPropProto = Object.create(null);
          if (template != this) {
            // Assumption: if `this` isn't the template being templatized,
            // assume that the template is not a Poylmer.Base, so prep it
            // for binding
            Polymer.Bind.prepareModel(proto);
          }
          // Create accessors for each parent prop that forward the property
          // to template instances through abstract _forwardParentProp API
          // that should be implemented by Templatizer users
          for (prop in parentProps) {
            var parentProp = '_parent_' + prop;
            var effects = [{
              kind: 'function',
              effect: this._createForwardPropEffector(prop)
            }, {
              kind: 'notify'
            }];
            Polymer.Bind._createAccessors(proto, parentProp, effects);
          }
        }
        // Instance setup
        if (template != this) {
          Polymer.Bind.prepareInstance(template);
          template._forwardParentProp =
            this._forwardParentProp.bind(this);
        }
        this._extendTemplate(template, proto);
      }
    },

    _createForwardPropEffector: function(prop) {
      return function(source, value) {
        this._forwardParentProp(prop, value);
      };
    },

    _createHostPropEffector: function(prop) {
      return function(source, value) {
        this.dataHost['_parent_' + prop] = value;
      };
    },

    // Similar to Polymer.Base.extend, but retains any previously set instance
    // values (_propertySet back on instance once accessor is installed)
    _extendTemplate: function(template, proto) {
      Object.getOwnPropertyNames(proto).forEach(function(n) {
        var val = template[n];
        var pd = Object.getOwnPropertyDescriptor(proto, n);
        Object.defineProperty(template, n, pd);
        if (val !== undefined) {
          template._propertySet(n, val);
        }
      });
    },

    // Extension point for Templatizer sub-classes
    _forwardInstancePath: function(inst, path, value) { },

    _notifyPathImpl: function(path, value) {
      var dataHost = this.dataHost;
      var dot = path.indexOf('.');
      var root = dot < 0 ? path : path.slice(0, dot);
      // Call extension point for Templatizer sub-classes
      dataHost._forwardInstancePath.call(dataHost, this, path, value);
      if (root in dataHost._parentProps) {
        dataHost.notifyPath('_parent_' + path, value);
      }
    },

    // Overrides Base notify-path module
    _pathEffector: function(path, value, fromAbove) {
      if (this._forwardParentPath) {
        if (path.indexOf('_parent_') === 0) {
          this._forwardParentPath(path.substring(8), value);
        }
      }
      Polymer.Base._pathEffector.apply(this, arguments);
    },

    _constructorImpl: function(model, host) {
      this._rootDataHost = host._getRootDataHost();
      this._setupConfigure(model);
      this._pushHost(host);
      this.root = this.instanceTemplate(this._template);
      this.root.__styleScoped = true;
      this._popHost();
      this._marshalAnnotatedNodes();
      this._marshalInstanceEffects();
      this._marshalAnnotatedListeners();
      // each row is a document fragment which is lost when we appendChild,
      // so we have to track each child individually
      var children = [];
      for (var n = this.root.firstChild; n; n=n.nextSibling) {
        children.push(n);
        n._templateInstance = this;
      }
      // Since archetype overrides Base/HTMLElement, Safari complains
      // when accessing `children`
      this._children = children;
      // ready self and children
      this._tryReady();
    },

    // Decorate events with model (template instance)
    _listenImpl: function(node, eventName, methodName) {
      var model = this;
      var host = this._rootDataHost;
      var handler = host._createEventHandler(node, eventName, methodName);
      var decorated = function(e) {
        e.model = model;
        handler(e);
      };
      host._listen(node, eventName, decorated);
    },

    _scopeElementClassImpl: function(node, value) {
      var host = this._rootDataHost;
      if (host) {
        return host._scopeElementClass(node, value);
      }
    },

    stamp: function(model) {
      model = model || {};
      if (this._parentProps) {
        for (var prop in this._parentProps) {
          model[prop] = this['_parent_' + prop];
        }
      }
      return new this.ctor(model, this);
    }

    // TODO(sorvell): note, using the template as host is ~5-10% faster if
    // elements have no default values.
    // _constructorImpl: function(model, host) {
    //   this._setupConfigure(model);
    //   host._beginHost();
    //   this.root = this.instanceTemplate(this._template);
    //   host._popHost();
    //   this._marshalTemplateContent();
    //   this._marshalAnnotatedNodes();
    //   this._marshalInstanceEffects();
    //   this._marshalAnnotatedListeners();
    //   this._ready();
    // },

    // stamp: function(model) {
    //   return new this.ctor(model, this.dataHost);
    // }


  };


;

  /**
   * Creates a pseudo-custom-element that maps property values to bindings
   * in DOM.
   * 
   * `stamp` method creates an instance of the pseudo-element. The instance
   * references a document-fragment containing the stamped and bound dom
   * via it's `root` property. 
   *  
   */
  Polymer({

    is: 'dom-template',
    extends: 'template',

    behaviors: [
      Polymer.Templatizer
    ],

    ready: function() {
      this.templatize(this);
    }

  });


;

  Polymer._collections = new WeakMap();

  Polymer.Collection = function(userArray) {
    Polymer._collections.set(userArray, this);
    this.userArray = userArray;
    this.store = userArray.slice();
    this.initMap();
  };

  Polymer.Collection.prototype = {

    constructor: Polymer.Collection,

    initMap: function() {
      var omap = this.omap = new WeakMap();
      var pmap = this.pmap = {};
      var s = this.store;
      for (var i=0; i<s.length; i++) {
        var item = s[i];
        if (item && typeof item == 'object') {
          omap.set(item, i);
        } else {
          pmap[item] = i;
        }
      }
    },

    add: function(item) {
      var key = this.store.push(item) - 1;
      if (item && typeof item == 'object') {
        this.omap.set(item, key);
      } else {
        this.pmap[item] = key;
      }
      return key;
    },

    removeKey: function(key) {
      this._removeFromMap(this.store[key]);
      delete this.store[key];
    },

    _removeFromMap: function(item) {
      if (typeof item == 'object') {
        this.omap.delete(item);
      } else {
        delete this.pmap[item];
      }
    },

    remove: function(item) {
      var key = this.getKey(item);
      this.removeKey(key);
      return key;
    },

    getKey: function(item) {
      if (typeof item == 'object') {
        return this.omap.get(item);
      } else {
        return this.pmap[item];
      }
    },

    getKeys: function() {
      return Object.keys(this.store);
    },

    setItem: function(key, value) {
      this.store[key] = value;
    },

    getItem: function(key) {
      return this.store[key];
    },

    getItems: function() {
      var items = [], store = this.store;
      for (var key in store) {
        items.push(store[key]);
      }
      return items;
    },

    applySplices: function(splices) {
      var keySplices = [];
      for (var i=0; i<splices.length; i++) {
        var j, o, key, s = splices[i];
        // Removed keys
        var removed = [];
        for (j=0; j<s.removed.length; j++) {
          o = s.removed[j];
          key = this.remove(o);
          removed.push(key);
        }
        // Added keys
        var added = [];
        for (j=0; j<s.addedCount; j++) {
          o = this.userArray[s.index + j];
          key = this.add(o);
          added.push(key);
        }
        // Record splice
        keySplices.push({
          index: s.index,
          removed: removed,
          removedItems: s.removed,
          added: added
        });
      }
      return keySplices;
    }

  };

  Polymer.Collection.get = function(userArray) {
    return Polymer._collections.get(userArray)
      || new Polymer.Collection(userArray);
  };


;

  Polymer({

    is: 'dom-repeat',
    extends: 'template',

    /**
     * Fired whenever DOM is added or removed by this template (by
     * default, rendering occurs lazily).  To force immediate rendering, call
     * `render`.
     *
     * @event dom-change
     */

    properties: {

      /**
       * An array containing items determining how many instances of the template
       * to stamp and that that each template instance should bind to.
       */
      items: {
        type: Array
      },

      /**
       * The name of the variable to add to the binding scope for the array
       * element associated with a given template instance.
       */
      as: {
        type: String,
        value: 'item'
      },

      /**
       * The name of the variable to add to the binding scope with the index
       * for the row.  If `sort` is provided, the index will reflect the
       * sorted order (rather than the original array order).
       */
      indexAs: {
        type: String,
        value: 'index'
      },

      /**
       * A function that should determine the sort order of the items.  This
       * property should either be provided as a string, indicating a method
       * name on the element's host, or else be an actual function.  The
       * function should match the sort function passed to `Array.sort`.
       * Using a sort function has no effect on the underlying `items` array.
       */
      sort: {
        type: Function,
        observer: '_sortChanged'
      },

      /**
       * A function that can be used to filter items out of the view.  This
       * property should either be provided as a string, indicating a method
       * name on the element's host, or else be an actual function.  The
       * function should match the sort function passed to `Array.filter`.
       * Using a filter function has no effect on the underlying `items` array.
       */
      filter: {
        type: Function,
        observer: '_filterChanged'
      },

      /**
       * When using a `filter` or `sort` function, the `observe` property
       * should be set to a space-separated list of the names of item
       * sub-fields that should trigger a re-sort or re-filter when changed.
       * These should generally be fields of `item` that the sort or filter
       * function depends on.
       */
      observe: {
        type: String,
        observer: '_observeChanged'
      },

      /**
       * When using a `filter` or `sort` function, the `delay` property
       * determines a debounce time after a change to observed item
       * properties that must pass before the filter or sort is re-run.
       * This is useful in rate-limiting shuffing of the view when
       * item changes may be frequent.
       */
      delay: Number
    },

    behaviors: [
      Polymer.Templatizer
    ],

    observers: [
      '_itemsChanged(items.*)'
    ],

    detached: function() {
      if (this.rows) {
        for (var i=0; i<this.rows.length; i++) {
          this._detachRow(i);
        }
      }
      this.rows = null;
    },

    ready: function() {
      // Template instance props that should be excluded from forwarding
      this._instanceProps = {
        __key__: true
      };
      this._instanceProps[this.as] = true;
      this._instanceProps[this.indexAs] = true;
      // Templatizing (generating the instance constructor) needs to wait
      // until ready, since won't have its template content handed back to
      // it until then
      if (!this.ctor) {
        this.templatize(this);
      }
    },

    _sortChanged: function() {
      var dataHost = this._getRootDataHost();
      this._sortFn = this.sort && (typeof this.sort == 'function' ?
        this.sort : dataHost[this.sort].bind(dataHost));
      this._fullRefresh = true;
      if (this.items) {
        this._debounceTemplate(this._render);
      }
    },

    _filterChanged: function() {
      var dataHost = this._getRootDataHost();
      this._filterFn = this.filter && (typeof this.filter == 'function' ?
        this.filter : dataHost[this.filter].bind(dataHost));
      this._fullRefresh = true;
      if (this.items) {
        this._debounceTemplate(this._render);
      }
    },

    _observeChanged: function() {
      this._observePaths = this.observe &&
        this.observe.replace('.*', '.').split(' ');
    },

    _itemsChanged: function(change) {
      if (change.path == 'items') {
        this.collection = this.items ? Polymer.Collection.get(this.items) : null;
        this._splices = [];
        this._fullRefresh = true;
        this._debounceTemplate(this._render);
      } else if (change.path == 'items.splices') {
        this._splices = this._splices.concat(change.value.keySplices);
        this._debounceTemplate(this._render);
      } else {
        // slice off 'items.' ('items.'.length == 6)
        var subpath = change.path.slice(6);
        this._forwardItemPath(subpath, change.value);
        this._checkObservedPaths(subpath);
      }
    },

    _checkObservedPaths: function(path) {
      if (this._observePaths) {
        path = path.substring(path.indexOf('.') + 1);
        var paths = this._observePaths;
        for (var i=0; i<paths.length; i++) {
          if (path.indexOf(paths[i]) === 0) {
            if (this.delay) {
              this.debounce('render', this._render, this.delay);
            } else {
              this._debounceTemplate(this._render);
            }
            return;
          }
        }
      }
    },

    render: function() {
      this._flushTemplates();
    },

    _render: function() {
      var c = this.collection;
      // Update insert/remove any changes and update sort/filter
      if (!this._fullRefresh) {
        if (this._sortFn) {
          this._applySplicesViewSort(this._splices);
        } else {
          if (this._filterFn) {
            // TODK(kschaaf): Filtering using array sort takes slow path
            this._fullRefresh = true;
          } else {
            this._applySplicesArraySort(this._splices);
          }
        }
      }
      if (this._fullRefresh) {
        this._sortAndFilter();
        this._fullRefresh = false;
      }
      this._splices = [];
      var rowForKey = this._rowForKey = {};
      var keys = this._orderedKeys;
      // Assign items and keys
      this.rows = this.rows || [];
      for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        var item = c.getItem(key);
        var row = this.rows[i];
        rowForKey[key] = i;
        if (!row) {
          this.rows.push(row = this._insertRow(i, null, item));
        }
        row[this.as] = item;
        row.__key__ = key;
        row[this.indexAs] = i;
      }
      // Remove extra
      for (; i<this.rows.length; i++) {
        this._detachRow(i);
      }
      this.rows.splice(keys.length, this.rows.length-keys.length);
      this.fire('dom-change');
    },

    _sortAndFilter: function() {
      var c = this.collection;
      // For array-based sort, key order comes from array
      if (!this._sortFn) {
        this._orderedKeys = [];
        var items = this.items;
        if (items) {
          for (var i=0; i<items.length; i++) {
            this._orderedKeys.push(c.getKey(items[i]));
          }
        }
      } else {
        this._orderedKeys = c ? c.getKeys() : [];
      }
      // Apply user filter to keys
      if (this._filterFn) {
        this._orderedKeys = this._orderedKeys.filter(function(a) {
          return this._filterFn(c.getItem(a));
        }, this);
      }
      // Apply user sort to keys
      if (this._sortFn) {
        this._orderedKeys.sort(function(a, b) {
          return this._sortFn(c.getItem(a), c.getItem(b));
        }.bind(this));
      }
    },

    _keySort: function(a, b) {
      return this.collection.getKey(a) - this.collection.getKey(b);
    },

    _applySplicesViewSort: function(splices) {
      var c = this.collection;
      var keys = this._orderedKeys;
      var rows = this.rows;
      var removedRows = [];
      var addedKeys = [];
      var pool = [];
      var sortFn = this._sortFn || this._keySort.bind(this);
      splices.forEach(function(s) {
        // Collect all removed row idx's
        for (var i=0; i<s.removed.length; i++) {
          var idx = this._rowForKey[s.removed[i]];
          if (idx != null) {
            removedRows.push(idx);
          }
        }
        // Collect all added keys
        for (var i=0; i<s.added.length; i++) {
          addedKeys.push(s.added[i]);
        }
      }, this);
      if (removedRows.length) {
        // Sort removed rows idx's
        removedRows.sort();
        // Remove keys and pool rows (backwards, so we don't invalidate rowForKey)
        for (var i=removedRows.length-1; i>=0 ; i--) {
          var idx = removedRows[i];
          pool.push(this._detachRow(idx));
          rows.splice(idx, 1);
          keys.splice(idx, 1);
        }
      }
      if (addedKeys.length) {
        // Filter added keys
        if (this._filterFn) {
          addedKeys = addedKeys.filter(function(a) {
            return this._filterFn(c.getItem(a));
          }, this);
        }
        // Sort added keys
        addedKeys.sort(function(a, b) {
          return this._sortFn(c.getItem(a), c.getItem(b));
        }.bind(this));
        // Insert new rows using sort (from pool or newly created)
        var start = 0;
        for (var i=0; i<addedKeys.length; i++) {
          start = this._insertRowIntoViewSort(start, addedKeys[i], pool);
        }
      }
    },

    _insertRowIntoViewSort: function(start, key, pool) {
      var c = this.collection;
      var item = c.getItem(key);
      var end = this.rows.length - 1;
      var idx = -1;
      var sortFn = this._sortFn || this._keySort.bind(this);
      // Binary search for insertion point
      while (start <= end) {
        var mid = (start + end) >> 1;
        var midKey = this._orderedKeys[mid];
        var cmp = sortFn(c.getItem(midKey), item);
        if (cmp < 0) {
          start = mid + 1;
        } else if (cmp > 0) {
          end = mid - 1;
        } else {
          idx = mid;
          break;
        }
      }
      if (idx < 0) {
        idx = end + 1;
      }
      // Insert key & row at insertion point
      this._orderedKeys.splice(idx, 0, key);
      this.rows.splice(idx, 0, this._insertRow(idx, pool, c.getItem(key)));
      return idx;
    },

    _applySplicesArraySort: function(splices) {
      var keys = this._orderedKeys;
      var pool = [];
      // Remove & pool rows first, to ensure we can fully reuse removed rows
      splices.forEach(function(s) {
        for (var i=0; i<s.removed.length; i++) {
          pool.push(this._detachRow(s.index + i));
        }
        this.rows.splice(s.index, s.removed.length);
      }, this);
      var c = this.collection;
      splices.forEach(function(s) {
        // Apply splices to keys
        var args = [s.index, s.removed.length].concat(s.added);
        keys.splice.apply(keys, args);
        // Insert new rows (from pool or newly created)
        for (var i=0; i<s.added.length; i++) {
          var item = c.getItem(s.added[i]);
          var row = this._insertRow(s.index + i, pool, item);
          this.rows.splice(s.index + i, 0, row);
        }
      }, this);
    },

    _detachRow: function(idx) {
      var row = this.rows[idx];
      var parentNode = Polymer.dom(this).parentNode;
      for (var i=0; i<row._children.length; i++) {
        var el = row._children[i];
        Polymer.dom(row.root).appendChild(el);
      }
      return row;
    },

    _insertRow: function(idx, pool, item) {
      var row = (pool && pool.pop()) || this._generateRow(idx, item);
      var beforeRow = this.rows[idx];
      var beforeNode = beforeRow ? beforeRow._children[0] : this;
      var parentNode = Polymer.dom(this).parentNode;
      Polymer.dom(parentNode).insertBefore(row.root, beforeNode);
      return row;
    },

    _generateRow: function(idx, item) {
      var model = {
        __key__: this.collection.getKey(item)
      };
      model[this.as] = item;
      model[this.indexAs] = idx;
      var row = this.stamp(model);
      return row;
    },

    // Implements extension point from Templatizer mixin
    _hideChildren: function(hidden) {
      if (this.rows) {
        for (var i=0; i<this.rows.length; i++) {
          var c$ = this.rows[i]._children;
          for (var j=0; j<c$.length; j++) {
            var c = c$[j];
            if (c.style) {
              c.style.display = hidden ? 'none' : '';
            }
            c._hideTemplateChildren = hidden;
          }
        }
      }
    },

    // Implements extension point from Templatizer
    // Called as a side effect of a template instance path change, responsible
    // for notifying items.<key-for-row>.<path> change up to host
    _forwardInstancePath: function(row, path, value) {
      if (path.indexOf(this.as + '.') === 0) {
        this.notifyPath('items.' + row.__key__ + '.' +
          path.slice(this.as.length + 1), value);
        return true;
      }
    },

    // Implements extension point from Templatizer mixin
    // Called as side-effect of a host property change, responsible for
    // notifying parent path change on each row
    _forwardParentProp: function(prop, value) {
      if (this.rows) {
        this.rows.forEach(function(row) {
          row[prop] = value;
        }, this);
      }
    },

    // Implements extension point from Templatizer
    // Called as side-effect of a host path change, responsible for
    // notifying parent path change on each row
    _forwardParentPath: function(path, value) {
      if (this.rows) {
        this.rows.forEach(function(row) {
          row.notifyPath(path, value, true);
        }, this);
      }
    },

    // Called as a side effect of a host items.<key>.<path> path change,
    // responsible for notifying item.<path> changes to row for key
    _forwardItemPath: function(path, value) {
      if (this._rowForKey) {
        var dot = path.indexOf('.');
        var key = path.substring(0, dot < 0 ? path.length : dot);
        var idx = this._rowForKey[key];
        var row = this.rows[idx];
        if (row) {
          if (dot >= 0) {
            path = this.as + '.' + path.substring(dot+1);
            row.notifyPath(path, value, true);
          } else {
            row[this.as] = value;
          }
        }
      }
    },

    _instanceForElement: function(el) {
      while (el && !el._templateInstance) {
        el = el.parentNode;
      }
      return el && el._templateInstance;
    },

    /**
     * Returns the item associated with a given element stamped by
     * this `dom-repeat`.
     */
    itemForElement: function(el) {
      var instance = this._instanceForElement(el);
      return instance && instance.item;
    },

    /**
     * Returns the `Polymer.Collection` key associated with a given
     * element stamped by this `dom-repeat`.
     */
    keyForElement: function(el) {
      var instance = this._instanceForElement(el);
      return instance && instance.__key__;
    },

    /**
     * Returns the row index for a given element stamped by this `dom-repeat`.
     * If `sort` is provided, the index will reflect the sorted order (rather
     * than the original array order).
     */
    indexForElement: function(el) {
      var instance = this._instanceForElement(el);
      return instance && instance[this.indexAs];
    }

  });



;

  Polymer({
    is: 'array-selector',

    properties: {

      /**
       * An array containing items from which selection will be made.
       */
      items: {
        type: Array,
        observer: '_itemsChanged'
      },

      /**
       * When `multi` is true, this is an array that contains any selected.
       * When `multi` is false, this is the currently selected item, or `null`
       * if no item is selected.
       */
      selected: {
        type: Object,
        notify: true
      },

      /**
       * When `true`, calling `select` on an item that is already selected
       * will deselect the item.
       */
      toggle: Boolean,

      /**
       * When `true`, multiple items may be selected at once (in this case,
       * `selected` is an array of currently selected items).  When `false`,
       * only one item may be selected at a time.
       */
      multi: Boolean
    },

    _itemsChanged: function() {
      // Unbind previous selection
      if (Array.isArray(this.selected)) {
        for (var i=0; i<this.selected.length; i++) {
          this.unlinkPaths('selected.' + i);
        }
      } else {
        this.unlinkPaths('selected');
      }
      // Initialize selection
      if (this.multi) {
        this.selected = [];
      } else {
        this.selected = null;
      }
    },

    /**
     * Deselects the given item if it is already selected.
     */
    deselect: function(item) {
      if (this.multi) {
        var scol = Polymer.Collection.get(this.selected);
        // var skey = scol.getKey(item);
        // if (skey >= 0) {
        var sidx = this.selected.indexOf(item);
        if (sidx >= 0) {
          var skey = scol.getKey(item);
          this.splice('selected', sidx, 1);
          // scol.remove(item);
          this.unlinkPaths('selected.' + skey);
          return true;
        }
      } else {
        this.selected = null;
        this.unlinkPaths('selected');
      }
    },

    /**
     * Selects the given item.  When `toggle` is true, this will automatically
     * deselect the item if already selected.
     */
    select: function(item) {
      var icol = Polymer.Collection.get(this.items);
      var key = icol.getKey(item);
      if (this.multi) {
        // var sidx = this.selected.indexOf(item);
        // if (sidx < 0) {
        var scol = Polymer.Collection.get(this.selected);
        var skey = scol.getKey(item);
        if (skey >= 0) {
          this.deselect(item);
        } else if (this.toggle) {
          this.push('selected', item);
          // this.linkPaths('selected.' + sidx, 'items.' + skey);
          // skey = Polymer.Collection.get(this.selected).add(item);
          this.async(function() {
            skey = scol.getKey(item);
            this.linkPaths('selected.' + skey, 'items.' + key);
          });
        }
      } else {
        if (this.toggle && item == this.selected) {
          this.deselect();
        } else {
          this.linkPaths('selected', 'items.' + key);
          this.selected = item;
        }
      }
    }

  });


;

  /**
   * Stamps the template iff the `if` property is truthy.
   *
   * When `if` becomes falsey, the stamped content is hidden but not
   * removed from dom. When `if` subsequently becomes truthy again, the content
   * is simply re-shown. This approach is used due to its favorable performance
   * characteristics: the expense of creating template content is paid only
   * once and lazily.
   *
   * Set the `restamp` property to true to force the stamped content to be
   * created / destroyed when the `if` condition changes.
   */
  Polymer({

    is: 'dom-if',
    extends: 'template',

    /**
     * Fired whenever DOM is added or removed/hidden by this template (by
     * default, rendering occurs lazily).  To force immediate rendering, call
     * `render`.
     *
     * @event dom-change
     */

    properties: {

      /**
       * A boolean indicating whether this template should stamp.
       */
      'if': {
        type: Boolean,
        value: false
      },

      /**
       * When true, elements will be removed from DOM and discarded when `if`
       * becomes false and re-created and added back to the DOM when `if`
       * becomes true.  By default, stamped elements will be hidden but left
       * in the DOM when `if` becomes false, which is generally results
       * in better performance.
       */
      restamp: {
        type: Boolean,
        value: false
      }

    },

    behaviors: [
      Polymer.Templatizer
    ],

    observers: [
      '_queueRender(if, restamp)'
    ],

    _queueRender: function() {
      this._debounceTemplate(this._render);
    },

    detached: function() {
      // TODO(kschaaf): add logic to re-stamp in attached?
      this._teardownInstance();
    },

    render: function() {
      this._flushTemplates();
    },

    _render: function() {
      if (this.if) {
        if (!this.ctor) {
          this._wrapTextNodes(this._content || this.content);
          this.templatize(this);
        }
        this._ensureInstance();
        this._hideTemplateChildren = false;
      } else if (this.restamp) {
        this._teardownInstance();
      }
      if (!this.restamp && this._instance) {
        this._hideTemplateChildren = !this.if;
      }
      if (this.if != this._lastIf) {
        this.fire('dom-change');
        this._lastIf = this.if;
      }
    },

    _ensureInstance: function() {
      if (!this._instance) {
        // TODO(sorvell): pickup stamping logic from x-repeat
        this._instance = this.stamp();
        var root = this._instance.root;
        // TODO(sorvell): this incantation needs to be simpler.
        var parent = Polymer.dom(Polymer.dom(this).parentNode);
        parent.insertBefore(root, this);
      }
    },

    _teardownInstance: function() {
      if (this._instance) {
        var c = this._instance._children;
        if (c) {
          // use first child parent, for case when dom-if may have been detached
          var parent = Polymer.dom(Polymer.dom(c[0]).parentNode);
          c.forEach(function(n) {
            parent.removeChild(n);
          });
        }
        this._instance = null;
      }
    },

    _wrapTextNodes: function(root) {
      // wrap text nodes in span so they can be hidden.
      for (var n = root.firstChild; n; n=n.nextSibling) {
        if (n.nodeType === Node.TEXT_NODE) {
          var s = document.createElement('span');
          root.insertBefore(s, n);
          s.appendChild(n);
          n = s;
        }
      }
    },

    // Implements extension point from Templatizer mixin
    _hideChildren: function(hidden) {
      if (this._instance) {
        var c$ = this._instance._children;
        for (var i=0; i<c$.length; i++) {
          var c = c$[i];
          c.style.display = hidden ? 'none' : '';
          c._hideTemplateChildren = hidden;
        }
      }
    },

    // Implements extension point from Templatizer mixin
    // Called as side-effect of a host property change, responsible for
    // notifying parent.<prop> path change on instance
    _forwardParentProp: function(prop, value) {
      if (this._instance) {
        this._instance[prop] = value;
      }
    },

    // Implements extension point from Templatizer
    // Called as side-effect of a host path change, responsible for
    // notifying parent.<path> path change on each row
    _forwardParentPath: function(path, value) {
      if (this._instance) {
        this._instance.notifyPath(path, value, true);
      }
    }

  });


;

  (function() {

    // monostate data
    var metaDatas = {};
    var metaArrays = {};

    Polymer.IronMeta = Polymer({

      is: 'iron-meta',

      properties: {

        /**
         * The type of meta-data.  All meta-data of the same type is stored
         * together.
         *
         * @attribute type
         * @type String
         * @default 'default'
         */
        type: {
          type: String,
          value: 'default',
          observer: '_typeChanged'
        },

        /**
         * The key used to store `value` under the `type` namespace.
         *
         * @attribute key
         * @type String
         * @default ''
         */
        key: {
          type: String,
          observer: '_keyChanged'
        },

        /**
         * The meta-data to store or retrieve.
         *
         * @attribute value
         * @type *
         * @default this
         */
        value: {
          type: Object,
          notify: true,
          observer: '_valueChanged'
        },

        /**
         * If true, `value` is set to the iron-meta instance itself.
         *
         * @attribute self
         * @type Boolean
         * @default false
         */
         self: {
          type: Boolean,
          observer: '_selfChanged'
        },

        /**
         * Array of all meta-data values for the given type.
         *
         * @property list
         * @type Array
         */
        list: {
          type: Array,
          notify: true
        }

      },

      /**
       * Only runs if someone invokes the factory/constructor directly
       * e.g. `new Polymer.IronMeta()`
       */
      factoryImpl: function(config) {
        if (config) {
          for (var n in config) {
            switch(n) {
              case 'type':
              case 'key':
              case 'value':
                this[n] = config[n];
                break;
            }
          }
        }
      },

      created: function() {
        // TODO(sjmiles): good for debugging?
        this._metaDatas = metaDatas;
        this._metaArrays = metaArrays;
      },

      _keyChanged: function(key, old) {
        this._resetRegistration(old);
      },

      _valueChanged: function(value) {
        this._resetRegistration(this.key);
      },

      _selfChanged: function(self) {
        if (self) {
          this.value = this;
        }
      },

      _typeChanged: function(type) {
        this._unregisterKey(this.key);
        if (!metaDatas[type]) {
          metaDatas[type] = {};
        }
        this._metaData = metaDatas[type];
        if (!metaArrays[type]) {
          metaArrays[type] = [];
        }
        this.list = metaArrays[type];
        this._registerKeyValue(this.key, this.value);
      },

      /**
       * Retrieves meta data value by key.
       *
       * @method byKey
       * @param {String} key The key of the meta-data to be returned.
       * @returns *
       */
      byKey: function(key) {
        return this._metaData && this._metaData[key];
      },

      _resetRegistration: function(oldKey) {
        this._unregisterKey(oldKey);
        this._registerKeyValue(this.key, this.value);
      },

      _unregisterKey: function(key) {
        this._unregister(key, this._metaData, this.list);
      },

      _registerKeyValue: function(key, value) {
        this._register(key, value, this._metaData, this.list);
      },

      _register: function(key, value, data, list) {
        if (key && data && value !== undefined) {
          data[key] = value;
          list.push(value);
        }
      },

      _unregister: function(key, data, list) {
        if (key && data) {
          if (key in data) {
            var value = data[key];
            delete data[key];
            this.arrayDelete(list, value);
          }
        }
      }

    });

    /**
    `iron-meta-query` can be used to access infomation stored in `iron-meta`.

    Examples:

    If I create an instance like this:

        <iron-meta key="info" value="foo/bar"></iron-meta>

    Note that keyUrl="foo/bar" is the metadata I've defined. I could define more
    attributes or use child nodes to define additional metadata.

    Now I can access that element (and it's metadata) from any `iron-meta-query` instance:

         var value = new Polymer.IronMetaQuery({key: 'info'}).value;

    @group Polymer Iron Elements
    @element iron-meta-query
    */
    Polymer.IronMetaQuery = Polymer({

      is: 'iron-meta-query',

      properties: {

        /**
         * The type of meta-data.  All meta-data of the same type is stored
         * together.
         *
         * @attribute type
         * @type String
         * @default 'default'
         */
        type: {
          type: String,
          value: 'default',
          observer: '_typeChanged'
        },

        /**
         * Specifies a key to use for retrieving `value` from the `type`
         * namespace.
         *
         * @attribute key
         * @type String
         */
        key: {
          type: String,
          observer: '_keyChanged'
        },

        /**
         * The meta-data to store or retrieve.
         *
         * @attribute value
         * @type *
         * @default this
         */
        value: {
          type: Object,
          notify: true,
          readOnly: true
        },

        /**
         * Array of all meta-data values for the given type.
         *
         * @property list
         * @type Array
         */
        list: {
          type: Array,
          notify: true
        }

      },

      /**
       * Actually a factory method, not a true constructor. Only runs if
       * someone invokes it directly (via `new Polymer.IronMeta()`);
       */
      constructor: function(config) {
        if (config) {
          for (var n in config) {
            switch(n) {
              case 'type':
              case 'key':
                this[n] = config[n];
                break;
            }
          }
        }
      },

      created: function() {
        // TODO(sjmiles): good for debugging?
        this._metaDatas = metaDatas;
        this._metaArrays = metaArrays;
      },

      _keyChanged: function(key) {
        this._setValue(this._metaData && this._metaData[key]);
      },

      _typeChanged: function(type) {
        this._metaData = metaDatas[type];
        this.list = metaArrays[type];
        if (this.key) {
          this._keyChanged(this.key);
        }
      },

      /**
       * Retrieves meta data value by key.
       *
       * @method byKey
       * @param {String} key The key of the meta-data to be returned.
       * @returns *
       */
      byKey: function(key) {
        return this._metaData && this._metaData[key];
      }

    });

  })();

;

  Polymer({

    is: 'iron-iconset',

    properties: {

      /**
       * The URL of the iconset image.
       *
       * @attribute src
       * @type string
       * @default ''
       */
      src: {
        type: String,
        observer: '_srcChanged'
      },

      /**
       * The name of the iconset.
       *
       * @attribute name
       * @type string
       * @default 'no-name'
       */
      name: {
        type: String,
        observer: '_nameChanged'
      },

      /**
       * The width of the iconset image. This must only be specified if the
       * icons are arranged into separate rows inside the image.
       *
       * @attribute width
       * @type number
       * @default 0
       */
      width: {
        type: Number,
        value: 0
      },

      /**
       * A space separated list of names corresponding to icons in the iconset
       * image file. This list must be ordered the same as the icon images
       * in the image file.
       *
       * @attribute icons
       * @type string
       * @default ''
       */
      icons: {
        type: String
      },

      /**
       * The size of an individual icon. Note that icons must be square.
       *
       * @attribute size
       * @type number
       * @default 24
       */
      size: {
        type: Number,
        value: 24
      },

      /**
       * The horizontal offset of the icon images in the inconset src image.
       * This is typically used if the image resource contains additional images
       * beside those intended for the iconset.
       *
       * @attribute offset-x
       * @type number
       * @default 0
       */
      _offsetX: {
        type: Number,
        value: 0
      },

      /**
       * The vertical offset of the icon images in the inconset src image.
       * This is typically used if the image resource contains additional images
       * beside those intended for the iconset.
       *
       * @attribute offset-y
       * @type number
       * @default 0
       */
      _offsetY: {
        type: Number,
        value: 0
      },

      /**
       * Array of fully-qualified names of icons in this set.
       */
      iconNames: {
        type: Array,
        notify: true
      }

    },

    hostAttributes: {
      // non-visual
      style: 'display: none;'
    },

    ready: function() {
      // theme data must exist at ready-time
      this._themes = this._mapThemes();
    },

    /**
     * Applies an icon to the given element as a css background image. This
     * method does not size the element, and it's usually necessary to set
     * the element's height and width so that the background image is visible.
     *
     * @method applyIcon
     * @param {Element} element The element to which the icon is applied.
     * @param {String|Number} icon The name or index of the icon to apply.
     * @param {String} theme (optional) The name or index of the icon to apply.
     * @param {Number} scale (optional, defaults to 1) Icon scaling factor.
     * @return {Element} The applied icon element.
     */
    applyIcon: function(element, icon, theme, scale) {
      this._validateIconMap();
      var offset = this._getThemedOffset(icon, theme);
      if (element && offset) {
        this._addIconStyles(element, this._srcUrl, offset, scale || 1,
          this.size, this.width);
      }
    },

    /**
     * Remove an icon from the given element by undoing the changes effected
     * by `applyIcon`.
     *
     * @param {Element} element The element from which the icon is removed.
     */
    removeIcon: function(element) {
      this._removeIconStyles(element.style);
    },

    _mapThemes: function() {
      var themes = Object.create(null);
      Polymer.dom(this).querySelectorAll('property[theme]')
        .forEach(function(property) {
          var offsetX = window.parseInt(
            property.getAttribute('offset-x'), 10
          ) || 0;
          var offsetY = window.parseInt(
            property.getAttribute('offset-y'), 10
          ) || 0;
          themes[property.getAttribute('theme')] = {
            offsetX: offsetX,
            offsetY: offsetY
          };
        });
      return themes;
    },

    _srcChanged: function(src) {
      // ensure `srcUrl` is always relative to the main document
      this._srcUrl = this.ownerDocument !== document
        ? this.resolveUrl(src) : src;
      this._prepareIconset();
    },

    _nameChanged: function(name) {
      this._prepareIconset();
    },

    _prepareIconset: function() {
      new Polymer.IronMeta({type: 'iconset', key: this.name, value: this});
    },

    _invalidateIconMap: function() {
      this._iconMapValid = false;
    },

    _validateIconMap: function() {
      if (!this._iconMapValid) {
        this._recomputeIconMap();
        this._iconMapValid = true;
      }
    },

    _recomputeIconMap: function() {
      this.iconNames = this._computeIconNames(this.icons);
      this.iconMap = this._computeIconMap(this._offsetX, this._offsetY,
        this.size, this.width, this.iconNames);
    },

    _computeIconNames: function(icons) {
      return icons.split(/\s+/g);
    },

    _computeIconMap: function(offsetX, offsetY, size, width, iconNames) {
      var iconMap = {};
      if (offsetX !== undefined && offsetY !== undefined) {
        var x0 = offsetX;
        iconNames.forEach(function(iconName) {
          iconMap[iconName] = {
            offsetX: offsetX,
            offsetY: offsetY
          };
          if ((offsetX + size) < width) {
            offsetX += size;
          } else {
            offsetX = x0;
            offsetY += size;
          }
        }, this);
      }
      return iconMap;
    },

    /**
     * Returns an object containing `offsetX` and `offsetY` properties which
     * specify the pixel location in the iconset's src file for the given
     * `icon` and `theme`. It's uncommon to call this method. It is useful,
     * for example, to manually position a css backgroundImage to the proper
     * offset. It's more common to use the `applyIcon` method.
     *
     * @method getThemedOffset
     * @param {String|Number} identifier The name of the icon or the index of
     * the icon within in the icon image.
     * @param {String} theme The name of the theme.
     * @returns {Object} An object specifying the offset of the given icon
     * within the icon resource file; `offsetX` is the horizontal offset and
     * `offsetY` is the vertical offset. Both values are in pixel units.
     */
    _getThemedOffset: function(identifier, theme) {
      var iconOffset = this._getIconOffset(identifier);
      var themeOffset = this._themes[theme];
      if (iconOffset && themeOffset) {
        return {
          offsetX: iconOffset.offsetX + themeOffset.offsetX,
          offsetY: iconOffset.offsetY + themeOffset.offsetY
        };
      }
      return iconOffset;
    },

    _getIconOffset: function(identifier) {
      // TODO(sjmiles): consider creating offsetArray (indexed by Number)
      // and having iconMap map names to indices, then and index is just
      // iconMap[identifier] || identifier (be careful of zero, store indices
      // as 1-based)
      return this.iconMap[identifier] ||
             this.iconMap[this.iconNames[Number(identifier)]];
    },

    _addIconStyles: function(element, url, offset, scale, size, width) {
      var style = element.style;
      style.backgroundImage = 'url(' + url + ')';
      style.backgroundPosition =
        (-offset.offsetX * scale + 'px') + ' ' +
        (-offset.offsetY * scale + 'px');
      style.backgroundSize = (scale === 1) ? 'auto' : width * scale + 'px';
      style.width = size + 'px';
      style.height = size + 'px';
      element.setAttribute('role', 'img');
    },

    _removeIconStyles: function(style) {
      style.background = '';
    }

  });


;

  Polymer({

    is: 'iron-media-query',

    properties: {

      /**
       * The Boolean return value of the media query.
       *
       * @attribute queryMatches
       * @type Boolean
       * @default false
       */
      queryMatches: {
        type: Boolean,
        value: false,
        readOnly: true,
        notify: true
      },

      /**
       * The CSS media query to evaluate.
       *
       * @attribute query
       * @type String
       */
      query: {
        type: String,
        observer: 'queryChanged'
      }

    },

    created: function() {
      this._mqHandler = this.queryHandler.bind(this);
    },

    queryChanged: function(query) {
      if (this._mq) {
        this._mq.removeListener(this._mqHandler);
      }
      if (query[0] !== '(') {
        query = '(' + query + ')';
      }
      this._mq = window.matchMedia(query);
      this._mq.addListener(this._mqHandler);
      this.queryHandler(this._mq);
    },

    queryHandler: function(mq) {
      this._setQueryMatches(mq.matches);
    }

  });


;

  /**
   * @param {!Function} selectCallback
   * @constructor
   */
  Polymer.IronSelection = function(selectCallback) {
    this.selection = [];
    this.selectCallback = selectCallback;
  };

  Polymer.IronSelection.prototype = {

    /**
     * Retrieves the selected item(s).
     *
     * @method get
     * @returns Returns the selected item(s). If the multi property is true,
     * `get` will return an array, otherwise it will return
     * the selected item or undefined if there is no selection.
     */
    get: function() {
      return this.multi ? this.selection : this.selection[0];
    },

    /**
     * Clears all the selection except the ones indicated.
     *
     * @method clear
     * @param {Array} excludes items to be excluded.
     */
    clear: function(excludes) {
      this.selection.slice().forEach(function(item) {
        if (!excludes || excludes.indexOf(item) < 0) {
          this.setItemSelected(item, false);
        }
      }, this);
    },

    /**
     * Indicates if a given item is selected.
     *
     * @method isSelected
     * @param {*} item The item whose selection state should be checked.
     * @returns Returns true if `item` is selected.
     */
    isSelected: function(item) {
      return this.selection.indexOf(item) >= 0;
    },

    /**
     * Sets the selection state for a given item to either selected or deselected.
     *
     * @method setItemSelected
     * @param {*} item The item to select.
     * @param {boolean} isSelected True for selected, false for deselected.
     */
    setItemSelected: function(item, isSelected) {
      if (item != null) {
        if (isSelected) {
          this.selection.push(item);
        } else {
          var i = this.selection.indexOf(item);
          if (i >= 0) {
            this.selection.splice(i, 1);
          }
        }
        if (this.selectCallback) {
          this.selectCallback(item, isSelected);
        }
      }
    },

    /**
     * Sets the selection state for a given item. If the `multi` property
     * is true, then the selected state of `item` will be toggled; otherwise
     * the `item` will be selected.
     *
     * @method select
     * @param {*} item The item to select.
     */
    select: function(item) {
      if (this.multi) {
        this.toggle(item);
      } else if (this.get() !== item) {
        this.setItemSelected(this.get(), false);
        this.setItemSelected(item, true);
      }
    },

    /**
     * Toggles the selection state for `item`.
     *
     * @method toggle
     * @param {*} item The item to toggle.
     */
    toggle: function(item) {
      this.setItemSelected(item, !this.isSelected(item));
    }

  };


;

  Polymer.IronSelectableBehavior = {

    properties: {

      /**
       * If you want to use the attribute value of an element for `selected` instead of the index,
       * set this to the name of the attribute.
       *
       * @attribute attrForSelected
       * @type {string}
       */
      attrForSelected: {
        type: String,
        value: null
      },

      /**
       * Gets or sets the selected element. The default is to use the index of the item.
       *
       * @attribute selected
       * @type {string}
       */
      selected: {
        type: String,
        notify: true
      },

      /**
       * Returns the currently selected item.
       *
       * @attribute selectedItem
       * @type {Object}
       */
      selectedItem: {
        type: Object,
        readOnly: true,
        notify: true
      },

      /**
       * The event that fires from items when they are selected. Selectable
       * will listen for this event from items and update the selection state.
       * Set to empty string to listen to no events.
       *
       * @attribute activateEvent
       * @type {string}
       * @default 'click'
       */
      activateEvent: {
        type: String,
        value: 'click',
        observer: '_activateEventChanged'
      },

      /**
       * This is a CSS selector sting.  If this is set, only items that matches the CSS selector
       * are selectable.
       *
       * @attribute selectable
       * @type {string}
       */
      selectable: String,

      /**
       * The class to set on elements when selected.
       *
       * @attribute selectedClass
       * @type {string}
       */
      selectedClass: {
        type: String,
        value: 'iron-selected'
      },

      /**
       * The attribute to set on elements when selected.
       *
       * @attribute selectedAttribute
       * @type {string}
       */
      selectedAttribute: {
        type: String,
        value: null
      }

    },

    observers: [
      '_updateSelected(attrForSelected, selected)'
    ],

    excludedLocalNames: {
      'template': 1
    },

    created: function() {
      this._bindActivateHandler = this._activateHandler.bind(this);
      this._bindFilterItem = this._filterItem.bind(this);
      this._selection = new Polymer.IronSelection(this._applySelection.bind(this));
    },

    attached: function() {
      this._observer = this._observeItems(this);
      this._contentObserver = this._observeContent(this);
    },

    detached: function() {
      if (this._observer) {
        this._observer.disconnect();
      }
      if (this._contentObserver) {
        this._contentObserver.disconnect();
      }
      this._removeListener(this.activateEvent);
    },

    /**
     * Returns an array of selectable items.
     *
     * @property items
     * @type Array
     */
    get items() {
      var nodes = Polymer.dom(this).queryDistributedElements(this.selectable || '*');
      return Array.prototype.filter.call(nodes, this._bindFilterItem);
    },

    /**
     * Returns the index of the given item.
     *
     * @method indexOf
     * @param {Object} item
     * @returns Returns the index of the item
     */
    indexOf: function(item) {
      return this.items.indexOf(item);
    },

    /**
     * Selects the given value.
     *
     * @method select
     * @param {string} value the value to select.
     */
    select: function(value) {
      this.selected = value;
    },

    /**
     * Selects the previous item.
     *
     * @method selectPrevious
     */
    selectPrevious: function() {
      var length = this.items.length;
      var index = (Number(this._valueToIndex(this.selected)) - 1 + length) % length;
      this.selected = this._indexToValue(index);
    },

    /**
     * Selects the next item.
     *
     * @method selectNext
     */
    selectNext: function() {
      var index = (Number(this._valueToIndex(this.selected)) + 1) % this.items.length;
      this.selected = this._indexToValue(index);
    },

    _addListener: function(eventName) {
      this.addEventListener(eventName, this._bindActivateHandler);
    },

    _removeListener: function(eventName) {
      this.removeEventListener(eventName, this._bindActivateHandler);
    },

    _activateEventChanged: function(eventName, old) {
      this._removeListener(old);
      this._addListener(eventName);
    },

    _updateSelected: function() {
      this._selectSelected(this.selected);
    },

    _selectSelected: function(selected) {
      this._selection.select(this._valueToItem(this.selected));
    },

    _filterItem: function(node) {
      return !this.excludedLocalNames[node.localName];
    },

    _valueToItem: function(value) {
      return (value == null) ? null : this.items[this._valueToIndex(value)];
    },

    _valueToIndex: function(value) {
      if (this.attrForSelected) {
        for (var i = 0, item; item = this.items[i]; i++) {
          if (this._valueForItem(item) == value) {
            return i;
          }
        }
      } else {
        return Number(value);
      }
    },

    _indexToValue: function(index) {
      if (this.attrForSelected) {
        var item = this.items[index];
        if (item) {
          return this._valueForItem(item);
        }
      } else {
        return index;
      }
    },

    _valueForItem: function(item) {
      return item[this.attrForSelected] || item.getAttribute(this.attrForSelected);
    },

    _applySelection: function(item, isSelected) {
      if (this.selectedClass) {
        this.toggleClass(this.selectedClass, isSelected, item);
      }
      if (this.selectedAttribute) {
        this.toggleAttribute(this.selectedAttribute, isSelected, item);
      }
      this._selectionChange();
      this.fire('iron-' + (isSelected ? 'select' : 'deselect'), {item: item});
    },

    _selectionChange: function() {
      this._setSelectedItem(this._selection.get());
    },

    // observe content changes under the given node.
    _observeContent: function(node) {
      var content = node.querySelector('content');
      if (content && content.parentElement === node) {
        return this._observeItems(node.domHost);
      }
    },

    // observe items change under the given node.
    _observeItems: function(node) {
      var observer = new MutationObserver(function() {
        if (this.selected != null) {
          this._updateSelected();
        }
      }.bind(this));
      observer.observe(node, {
        childList: true,
        subtree: true
      });
      return observer;
    },

    _activateHandler: function(e) {
      var t = e.target;
      var items = this.items;
      while (t && t != this) {
        var i = items.indexOf(t);
        if (i >= 0) {
          var value = this._indexToValue(i);
          this._itemActivate(value, t);
          return;
        }
        t = t.parentNode;
      }
    },

    _itemActivate: function(value, item) {
      if (!this.fire('iron-activate',
          {selected: value, item: item}, {cancelable: true}).defaultPrevented) {
        this.select(value);
      }
    }

  };


;

  Polymer.IronMultiSelectableBehavior = [
    Polymer.IronSelectableBehavior, {

      properties: {

        /**
         * If true, multiple selections are allowed.
         *
         * @attribute multi
         * @type Boolean
         * @default false
         */
        multi: {
          type: Boolean,
          value: false,
          observer: 'multiChanged'
        },

        /**
         * Gets or sets the selected elements. This is used instead of `selected` when `multi`
         * is true.
         *
         * @attribute selectedValues
         * @type Array
         */
        selectedValues: {
          type: Array,
          notify: true
        },

        /**
         * Returns an array of currently selected items.
         *
         * @attribute selectedItems
         * @type Array
         */
        selectedItems: {
          type: Array,
          readOnly: true,
          notify: true
        },

      },

      observers: [
        '_updateSelected(attrForSelected, selectedValues)'
      ],

      /**
       * Selects the given value. If the `multi` property is true, then the selected state of the
       * `value` will be toggled; otherwise the `value` will be selected.
       *
       * @method select
       * @param {string} value the value to select.
       */
      select: function(value) {
        if (this.multi) {
          if (this.selectedValues) {
            this._toggleSelected(value);
          } else {
            this.selectedValues = [value];
          }
        } else {
          this.selected = value;
        }
      },

      multiChanged: function(multi) {
        this._selection.multi = multi;
      },

      _updateSelected: function() {
        if (this.multi) {
          this._selectMulti(this.selectedValues);
        } else {
          this._selectSelected(this.selected);
        }
      },

      _selectMulti: function(values) {
        this._selection.clear();
        if (values) {
          for (var i = 0; i < values.length; i++) {
            this._selection.setItemSelected(this._valueToItem(values[i]), true);
          }
        }
      },

      _selectionChange: function() {
        var s = this._selection.get();
        if (this.multi) {
          this._setSelectedItems(s);
        } else {
          this._setSelectedItems([s]);
          this._setSelectedItem(s);
        }
      },

      _toggleSelected: function(value) {
        var i = this.selectedValues.indexOf(value);
        var unselected = i < 0;
        if (unselected) {
          this.selectedValues.push(value);
        } else {
          this.selectedValues.splice(i, 1);
        }
        this._selection.setItemSelected(this._valueToItem(value), unselected);
      }

    }
  ];


;

  Polymer({

    is: 'iron-selector',

    behaviors: [
      Polymer.IronMultiSelectableBehavior
    ]

  });


;

  Polymer.IronMenuBehavior = Polymer.IronMultiSelectableBehavior.concat({

    properties: {

      /**
       * Returns the currently focused item.
       *
       * @attribute focusedItem
       * @type Object
       */
      focusedItem: {
        observer: '_focusedItemChanged',
        readOnly: true,
        type: Object
      },

      /**
       * The attribute to use on menu items to look up the item title. Typing the first
       * letter of an item when the menu is open focuses that item. If unset, `textContent`
       * will be used.
       *
       * @attribute attrForItemTitle
       * @type String
       */
      attrForItemTitle: {
        type: String
      }

    },

    observers: [
      '_selectedItemsChanged(selectedItems)',
      '_selectedItemChanged(selectedItem)'
    ],

    hostAttributes: {
      'role': 'menu',
      'tabindex': '0'
    },

    listeners: {
      'focus': '_onFocus',
      'keydown': '_onKeydown'
    },

    _focusedItemChanged: function(focusedItem, old) {
      old && old.setAttribute('tabindex', '-1');
      if (focusedItem) {
        focusedItem.setAttribute('tabindex', '0');
        focusedItem.focus();
      }
    },

    _selectedItemsChanged: function(selectedItems) {
      this._setFocusedItem(selectedItems[0]);
    },

    _selectedItemChanged: function(selectedItem) {
      this._setFocusedItem(selectedItem);
    },

    _onFocus: function(event) {
      // clear the cached focus item
      this._setFocusedItem(null);
      // focus the selected item when the menu receives focus, or the first item
      // if no item is selected
      var selectedItem = this.multi ? (this.selectedItems && this.selectedItems[0]) : this.selectedItem;
      if (selectedItem) {
        this._setFocusedItem(selectedItem);
      } else {
        this._setFocusedItem(this.items[0]);
      }
    },

    _onKeydown: function(event) {
      // FIXME want to define these somewhere, core-a11y-keys?
      var DOWN = 40;
      var UP = 38;
      var ESC = 27;
      var ENTER = 13;
      if (event.keyCode === DOWN) {
        // up and down arrows moves the focus
        this._focusNext();
      } else if (event.keyCode === UP) {
        this._focusPrevious();
      } else if (event.keyCode === ESC) {
        // esc blurs the control
        this.focusedItem.blur();
      } else if (event.keyCode === ENTER) {
        // enter activates the item unless it is disabled
        if (!this.focusedItem.hasAttribute('disabled')) {
          this._activateHandler(event);
        }
      } else {
        // all other keys focus the menu item starting with that character
        for (var i = 0, item; item = this.items[i]; i++) {
          var attr = this.attrForItemTitle || 'textContent';
          var title = item[attr] || item.getAttribute(attr);
          if (title && title.trim().charAt(0).toLowerCase() === String.fromCharCode(event.keyCode).toLowerCase()) {
            this._setFocusedItem(item);
            break;
          }
        }
      }
    },

    _focusPrevious: function() {
      var length = this.items.length;
      var index = (Number(this.indexOf(this.focusedItem)) - 1 + length) % length;
      this._setFocusedItem(this.items[index]);
    },

    _focusNext: function() {
      var index = (Number(this.indexOf(this.focusedItem)) + 1) % this.items.length;
      this._setFocusedItem(this.items[index]);
    }

  });


;

  Polymer({

    is: 'iron-icon',

    properties: {

      icon: {
        type: String,
        observer: '_iconChanged'
      },

      theme: {
        type: String,
        observer: '_updateIcon'
      },

      src: {
        type: String,
        observer: '_srcChanged'
      }

    },

    _DEFAULT_ICONSET: 'icons',

    _iconChanged: function(icon) {
      var parts = (icon || '').split(':');
      this._iconName = parts.pop();
      this._iconsetName = parts.pop() || this._DEFAULT_ICONSET;
      this._updateIcon();
    },

    _srcChanged: function(src) {
      this._updateIcon();
    },

    _usesIconset: function() {
      return this.icon || !this.src;
    },

    _updateIcon: function() {
      if (this._usesIconset()) {
        this._iconset =  this.$.meta.byKey(this._iconsetName);
        if (this._iconset) {
          this._iconset.applyIcon(this, this._iconName, this.theme);
        } else {
          console.warn('iron-icon: could not find iconset `'
            + this._iconsetName + '`, did you import the iconset?');
        }
      } else {
        if (!this._img) {
          this._img = document.createElement('img');
          this._img.style.width = '100%';
          this._img.style.height = '100%';
        }
        this._img.src = this.src;
        Polymer.dom(this.root).appendChild(this._img);
      }
    }

  });


;

  (function() {

    'use strict';

    function classNames(obj) {
      var classNames = [];
      for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key]) {
          classNames.push(key);
        }
      }

      return classNames.join(' ');
    }

    Polymer({

      is: 'paper-drawer-panel',

      /**
       * Fired when the narrow layout changes.
       *
       * @event paper-responsive-change {{narrow: boolean}} detail -
       *     narrow: true if the panel is in narrow layout.
       */

      /**
       * Fired when the selected panel changes.
       *
       * Listening for this event is an alternative to observing changes in the `selected` attribute.
       * This event is fired both when a panel is selected and deselected.
       * The `isSelected` detail property contains the selection state.
       *
       * @event paper-select {{isSelected: boolean, item: Object}} detail -
       *     isSelected: True for selection and false for deselection.
       *     item: The panel that the event refers to.
       */

      properties: {

        /**
         * The panel to be selected when `paper-drawer-panel` changes to narrow
         * layout.
         *
         * @attribute defaultSelected
         * @type string
         * @default 'main'
         */
        defaultSelected: {
          type: String,
          value: 'main'
        },

        /**
         * If true, swipe from the edge is disable.
         *
         * @attribute disableEdgeSwipe
         * @type boolean
         * @default false
         */
        disableEdgeSwipe: Boolean,

        /**
         * If true, swipe to open/close the drawer is disabled.
         *
         * @attribute disableSwipe
         * @type boolean
         * @default false
         */
        disableSwipe: Boolean,

        // Whether the user is dragging the drawer interactively.
        dragging: {
          type: Boolean,
          value: false
        },

        /**
         * Width of the drawer panel.
         *
         * @attribute drawerWidth
         * @type string
         * @default '256px'
         */
        drawerWidth: {
          type: String,
          value: '256px'
        },

        // How many pixels on the side of the screen are sensitive to edge
        // swipes and peek.
        edgeSwipeSensitivity: {
          type: Number,
          value: 30
        },

        /**
         * If true, ignore `responsiveWidth` setting and force the narrow layout.
         *
         * @attribute forceNarrow
         * @type boolean
         * @default false
         */
        forceNarrow: {
          observer: 'forceNarrowChanged',
          type: Boolean,
          value: false
        },

        // Whether the browser has support for the transform CSS property.
        hasTransform: {
          type: Boolean,
          value: function() {
            return 'transform' in this.style;
          }
        },

        // Whether the browser has support for the will-change CSS property.
        hasWillChange: {
          type: Boolean,
          value: function() {
            return 'willChange' in this.style;
          }
        },

        /**
         * Returns true if the panel is in narrow layout.  This is useful if you
         * need to show/hide elements based on the layout.
         *
         * @attribute narrow
         * @type boolean
         * @default false
         */
        narrow: {
          reflectToAttribute: true,
          type: Boolean,
          value: false
        },

        // Whether the drawer is peeking out from the edge.
        peeking: {
          type: Boolean,
          value: false
        },

        /**
         * Max-width when the panel changes to narrow layout.
         *
         * @attribute responsiveWidth
         * @type string
         * @default '640px'
         */
        responsiveWidth: {
          type: String,
          value: '640px'
        },

        /**
         * If true, position the drawer to the right.
         *
         * @attribute rightDrawer
         * @type boolean
         * @default false
         */
        rightDrawer: {
          type: Boolean,
          value: false
        },

        /**
         * The panel that is being selected. `drawer` for the drawer panel and
         * `main` for the main panel.
         *
         * @attribute selected
         * @type string
         * @default null
         */
        selected: {
          reflectToAttribute: true,
          type: String,
          value: null
        },

        /**
         * The attribute on elements that should toggle the drawer on tap, also elements will
         * automatically be hidden in wide layout.
         */
        drawerToggleAttribute: {
          type: String,
          value: 'paper-drawer-toggle'
        },

        /**
         * Whether the transition is enabled.
         */
        transition: {
          type: Boolean,
          value: false
        },

        /**
         * Starting X coordinate of a tracking gesture. It is non-null only between trackStart and
         * trackEnd events.
         * @type {?number}
         */
        _startX: {
          type: Number,
          value: null
        }

      },

      listeners: {
        click: 'onClick',
        track: 'onTrack',
        down: 'downHandler',
        up: 'upHandler'
      },

      _computeIronSelectorClass: function(narrow, transition, dragging, rightDrawer) {
        return classNames({
          dragging: dragging,
          'narrow-layout': narrow,
          'right-drawer': rightDrawer,
          transition: transition
        });
      },

      _computeDrawerStyle: function(drawerWidth) {
        return 'width:' + drawerWidth + ';';
      },

      _computeMainStyle: function(narrow, rightDrawer, drawerWidth) {
        var style = '';

        style += 'left:' + ((narrow || rightDrawer) ? '0' : drawerWidth) + ';'

        if (rightDrawer) {
          style += 'right:' + (narrow ? '' : drawerWidth) + ';';
        } else {
          style += 'right:;'
        }

        return style;
      },

      _computeMediaQuery: function(forceNarrow, responsiveWidth) {
        return forceNarrow ? '' : '(max-width: ' + responsiveWidth + ')';
      },

      _computeSwipeOverlayHidden: function(narrow, disableEdgeSwipe) {
        return !narrow || disableEdgeSwipe;
      },

      onTrack: function(event) {
        switch (event.detail.state) {
          case 'end':
            this.trackEnd(event);
            break;
          case 'move':
            this.trackX(event);
            break;
          case 'start':
            this.trackStart(event);
            break;
        }
      },

      ready: function() {
        // Avoid transition at the beginning e.g. page loads and enable
        // transitions only after the element is rendered and ready.
        this.transition = true;
      },

      /**
       * Toggles the panel open and closed.
       *
       * @method togglePanel
       */
      togglePanel: function() {
        if (this.isMainSelected()) {
          this.openDrawer();
        } else {
          this.closeDrawer();
        }
      },

      /**
       * Opens the drawer.
       *
       * @method openDrawer
       */
      openDrawer: function() {
        this.selected = 'drawer';
      },

      /**
       * Closes the drawer.
       *
       * @method closeDrawer
       */
      closeDrawer: function() {
        this.selected = 'main';
      },

      _responsiveChange: function(narrow) {
        this.narrow = narrow;

        if (this.narrow) {
          this.selected = this.defaultSelected;
        }

        this.setAttribute('touch-action', this.swipeAllowed() ? 'pan-y' : '');
        this.fire('paper-responsive-change', {narrow: this.narrow});
      },

      onQueryMatchesChanged: function(e) {
        this._responsiveChange(e.detail.value);
      },

      forceNarrowChanged: function() {
        this._responsiveChange(this.forceNarrow);
      },

      swipeAllowed: function() {
        return this.narrow && !this.disableSwipe;
      },

      isMainSelected: function() {
        return this.selected === 'main';
      },

      startEdgePeek: function() {
        this.width = this.$.drawer.offsetWidth;
        this.moveDrawer(this.translateXForDeltaX(this.rightDrawer ?
            -this.edgeSwipeSensitivity : this.edgeSwipeSensitivity));
        this.peeking = true;
      },

      stopEdgePeek: function() {
        if (this.peeking) {
          this.peeking = false;
          this.moveDrawer(null);
        }
      },

      downHandler: function(e) {
        if (!this.dragging && this.isMainSelected() && this.isEdgeTouch(e)) {
          this.startEdgePeek();
        }
      },

      upHandler: function(e) {
        this.stopEdgePeek();
      },

      onClick: function(e) {
        var isTargetToggleElement = e.target &&
          this.drawerToggleAttribute &&
          e.target.hasAttribute(this.drawerToggleAttribute);

        if (isTargetToggleElement) {
          this.togglePanel();
        }
      },

      isEdgeTouch: function(event) {
        var x = event.detail.x;

        return !this.disableEdgeSwipe && this.swipeAllowed() &&
          (this.rightDrawer ?
            x >= this.offsetWidth - this.edgeSwipeSensitivity :
            x <= this.edgeSwipeSensitivity);
      },

      trackStart: function(event) {
        if (this.swipeAllowed()) {
          this.dragging = true;
          this._startX = event.detail.x;

          if (this.isMainSelected()) {
            this.dragging = this.peeking || this.isEdgeTouch(event);
          }

          if (this.dragging) {
            this.width = this.$.drawer.offsetWidth;
            this.transition = false;

            // TODO: Re-enable when tap gestures are implemented.
            //
            // e.preventTap();
          }
        }
      },

      translateXForDeltaX: function(deltaX) {
        var isMain = this.isMainSelected();

        if (this.rightDrawer) {
          return Math.max(0, isMain ? this.width + deltaX : deltaX);
        } else {
          return Math.min(0, isMain ? deltaX - this.width : deltaX);
        }
      },

      trackX: function(event) {
        var dx = event.detail.x - this._startX;

        if (this.dragging) {
          if (this.peeking) {
            if (Math.abs(dx) <= this.edgeSwipeSensitivity) {
              // Ignore trackx until we move past the edge peek.
              return;
            }

            this.peeking = false;
          }

          this.moveDrawer(this.translateXForDeltaX(dx));
        }
      },

      trackEnd: function(event) {
        if (this.dragging) {
          var xDirection = (event.detail.x - this._startX) > 0;

          this.dragging = false;
          this._startX = null;
          this.transition = true;
          this.moveDrawer(null);

          if (this.rightDrawer) {
            this[(xDirection > 0) ? 'closeDrawer' : 'openDrawer']();
          } else {
            this[(xDirection > 0) ? 'openDrawer' : 'closeDrawer']();
          }
        }
      },

      transformForTranslateX: function(translateX) {
        if (translateX === null) {
          return '';
        }

        return this.hasWillChange ? 'translateX(' + translateX + 'px)' :
            'translate3d(' + translateX + 'px, 0, 0)';
      },

      moveDrawer: function(translateX) {
        var s = this.$.drawer.style;

        if (this.hasTransform) {
          s.transform = this.transformForTranslateX(translateX);
        } else {
          s.webkitTransform = this.transformForTranslateX(translateX);
        }
      },

      onSelect: function(e) {
        e.preventDefault();
        this.selected = e.detail.selected;
      }

    });

  }());


;

  (function() {

    'use strict';

    var MODE_CONFIGS = {
      noShadow: {
        cover: true,
        scroll: true,
        seamed: true
      },
      outerScroll: {
        scroll: true
      },
      shadowMode: {
        waterfall: true,
        'waterfall-tall': true
      },
      tallMode: {
        'waterfall-tall': true
      }
    };

    Polymer({

      is: 'paper-header-panel',

      /**
       * Fired when the content has been scrolled.  `event.detail.target` returns
       * the scrollable element which you can use to access scroll info such as
       * `scrollTop`.
       *
       *     <paper-header-panel on-scroll="{{scrollHandler}}">
       *       ...
       *     </paper-header-panel>
       *
       *
       *     scrollHandler: function(event) {
       *       var scroller = event.detail.target;
       *       console.log(scroller.scrollTop);
       *     }
       *
       * @event scroll
       */

      properties: {

        /**
         * Controls header and scrolling behavior. Options are
         * `standard`, `seamed`, `waterfall`, `waterfall-tall`, `scroll` and
         * `cover`. Default is `standard`.
         *
         * `standard`: The header is a step above the panel. The header will consume the
         * panel at the point of entry, preventing it from passing through to the
         * opposite side.
         *
         * `seamed`: The header is presented as seamed with the panel.
         *
         * `waterfall`: Similar to standard mode, but header is initially presented as
         * seamed with panel, but then separates to form the step.
         *
         * `waterfall-tall`: The header is initially taller (`tall` class is added to
         * the header).  As the user scrolls, the header separates (forming an edge)
         * while condensing (`tall` class is removed from the header).
         *
         * `scroll`: The header keeps its seam with the panel, and is pushed off screen.
         *
         * `cover`: The panel covers the whole `paper-header-panel` including the
         * header. This allows user to style the panel in such a way that the panel is
         * partially covering the header.
         *
         *     <style>
         *       paper-header-panel[mode=cover]::shadow #mainContainer {
         *         left: 80px;
         *       }
         *       .content {
         *         margin: 60px 60px 60px 0;
         *       }
         *     </style>
         *
         *     <paper-header-panel mode="cover">
         *       <paper-toolbar class="tall">
         *         <core-icon-button icon="menu"></core-icon-button>
         *       </paper-toolbar>
         *       <div class="content"></div>
         *     </paper-header-panel>
         *
         * @attribute mode
         * @type string
         * @default ''
         */
        mode: {
          type: String,
          value: ''
        },

        /**
         * If true, the drop-shadow is always shown no matter what mode is set to.
         *
         * @attribute shadow
         * @type boolean
         * @default false
         */
        shadow: {
          type: Boolean,
          value: false
        },

        /**
         * The class used in waterfall-tall mode.  Change this if the header
         * accepts a different class for toggling height, e.g. "medium-tall"
         *
         * @attribute tallClass
         * @type string
         * @default 'tall'
         */
        tallClass: {
          type: String,
          value: 'tall'
        },

        _animateDuration: {
          value: 200
        },

        _atTop: {
          value: true
        }
      },

      _computeDropShadowHidden: function(_atTop, mode, shadow) {
        var needsShadow = _atTop && MODE_CONFIGS.shadowMode[mode] || MODE_CONFIGS.noShadow[mode];

        return !this.shadow && needsShadow;
      },

      _computeMainContainerClass: function(mode) {
        if (mode !== 'cover') { return 'flex'; }
      },

      ready: function() {
        this.scrollHandler = this.scroll.bind(this);
        this.addListener();

        // Run `scroll` logic once to initialze class names, etc.
        this.scroll();
      },

      detached: function() {
        this.removeListener(this.mode);
      },

      addListener: function() {
        this.scroller.addEventListener('scroll', this.scrollHandler);
      },

      removeListener: function(mode) {
        this.scroller.removeEventListener('scroll', this.scrollHandler);
      },

      domReady: function() {
        this.async('scroll');
      },

      modeChanged: function(old) {
        var configs = MODE_CONFIGS;
        var header = this.header;

        if (header) {
          // in tallMode it may add tallClass to the header; so do the cleanup
          // when mode is changed from tallMode to not tallMode
          if (configs.tallMode[old] && !configs.tallMode[this.mode]) {
            header.classList.remove(this.tallClass);
            this.async(function() {
              header.classList.remove('animate');
            }, null, this._animateDuration);
          } else {
            header.classList.toggle('animate', configs.tallMode[this.mode]);
          }
        }

        if (configs && (configs.outerScroll[this.mode] || configs.outerScroll[old])) {
          this.removeListener(old);
          this.addListener();
        }

        this.scroll();
      },

      get header() {
        return Polymer.dom(this.$.headerContent).getDistributedNodes()[0];
      },

      getScrollerForMode: function(mode) {
        return MODE_CONFIGS.outerScroll[mode] ?
            this.$.outerContainer : this.$.mainContainer;
      },

      /**
       * Returns the scrollable element.
       *
       * @property scroller
       * @type Object
       */
      get scroller() {
        return this.getScrollerForMode(this.mode);
      },

      scroll: function() {
        var main = this.$.mainContainer;
        var header = this.header;

        this._atTop = (main.scrollTop === 0);

        if (header && MODE_CONFIGS.tallMode[this.mode]) {
          header.classList.toggle(this.tallClass, this._atTop ||
              header.classList.contains(this.tallClass) &&
              main.scrollHeight < this.$.outerContainer.offsetHeight);
        }

        this.fire('scroll', {target: this.scroller}, this, false);
      }

    });

  })();


;

  (function() {

    'use strict';

    function classNames(obj) {
      var classNames = [];
      for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key]) {
          classNames.push(key);
        }
      }

      return classNames.join(' ');
    }

    Polymer({

      is: 'paper-toolbar',

      properties: {

        /**
         * Controls how the items are aligned horizontally when they are placed
         * at the bottom.
         * Options are `start`, `center`, `end`, `justified` and `around`.
         *
         * @attribute bottomJustify
         * @type string
         * @default ''
         */
        bottomJustify: {
          type: String,
          value: ''
        },

        /**
         * Controls how the items are aligned horizontally.
         * Options are `start`, `center`, `end`, `justified` and `around`.
         *
         * @attribute justify
         * @type string
         * @default ''
         */
        justify: {
          type: String,
          value: ''
        },

        /**
         * Controls how the items are aligned horizontally when they are placed
         * in the middle.
         * Options are `start`, `center`, `end`, `justified` and `around`.
         *
         * @attribute middleJustify
         * @type string
         * @default ''
         */
        middleJustify: {
          type: String,
          value: ''
        }

      },

      _computeBarClassName: function(barJustify) {
        var classObj = {
          center: true,
          horizontal: true,
          layout: true,
          'toolbar-tools': true
        };

        // If a blank string or any falsy value is given, no other class name is
        // added.
        if (barJustify) {
          var justifyClassName = (barJustify === 'justified') ?
              barJustify :
              barJustify + '-justified';

          classObj[justifyClassName] = true;
        }

        return classNames(classObj);
      }

    });

  }());


;

(function() {

  Polymer({

    is: 'paper-menu',

    behaviors: [
      Polymer.IronMenuBehavior
    ]

  });

})();


;

(function() {

  Polymer({

    is: 'paper-item',

    hostAttributes: {
      role: 'listitem'
    }

  });

})();

