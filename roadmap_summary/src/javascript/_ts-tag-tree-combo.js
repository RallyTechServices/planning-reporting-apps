/**
 **/
    Ext.define('Rally.technicalservices.picker.TagTreePicker', {
        extend: 'Ext.ux.TreeCombo',
        alias: 'widget.tstagtreepicker',

        componentCls: 'rui-triggerfield rui-project-picker',

        placeholderCls: 'rui-multi-object-placeholder',

        editable: false,

        /**
         * @cfg {String}
         * Text shown during initial load
         */
        loadingText: 'Loading...',
        /**
         * @cfg {String}
         * Separator to define folder breaks
         */
        separator: ':',
        /**
         * @cfg {String} displayField
         * The field inside the model that will be used as the node's text.
         * Defaults to the default value of {@link Ext.tree.Panel}'s `displayField` configuration.
         */
        displayField: 'text',
        
        selectChildren: true,
        
        canSelectFolders: true,

        multiselect: true,

            
        initComponent: function () {
            var me = this;
            
            this.store = Ext.create('Ext.data.TreeStore', {
                root: {}
            });
            
            this._getTagRootNode().then({
                scope: this,
                success: function(root) {
                    this.store.setRootNode(root);
                },
                failure: function(message) {
                    Ext.msg.alert(message);
                }
            });
            
            me.callParent(arguments);
        },

        _getTagRootNode: function () {
            var deferred = Ext.create('Deft.Deferred');
            var me = this;
            
            Ext.create('Rally.data.wsapi.Store',{
                model: 'tag',
                autoLoad: true,
                sorters: [{property:'Name',direction:'ASC'}],
                filters: [{property:'Archived', value: 'false'}]
            }).load({
                callback : function(records, operation, successful) {
                    if (successful){
                        var root = this._createRootNode(records);
                        deferred.resolve(root);
                    } else {
                        me.logger.log("Failed: ", operation);
                        deferred.reject('Problem getting stories: ' + operation.error.errors.join('. '));
                    }
                },
                scope: this
            });
            
            return deferred.promise;
        },
        
        // assume that tag objects are provided in order of Name
        _createRootNode: function(tags) {
            var hash = {};
            
            Ext.Array.each( tags, function(tag){
                var name = tag.get('Name');
                var name_array = name.split(this.separator);
                
                hash = this._setHashValue(hash,name,name_array);
            },this);
                        
            var root = {
                text: 'Tags',
                expanded: 'true',
                children: []
            };
                
            Ext.Object.each(hash, function(key,value){
                if ( value.rootItem ) {
                    root.children.push(value);
                }
            });

            return root;
        },
        
        _counterValue: 1,
        
        _getCounterValue: function() {
            this._counterValue = this._counterValue + 1;
            return this._counterValue;
        },
        
        _setHashValue: function(hash,full_name,name_array,parent) {
            if ( name_array.length > 0 ) {
                var name = name_array[0];
                var item_hash = {
                    id: full_name,
                    text: name,
                    children:[],
                    leaf: true,
                    checked: false,
                    rootItem: false
                };
                
                if( parent ) {
                    parent.children.push(item_hash);
                }
                
                if ( !parent ) {
                    item_hash.rootItem = true;
                }
                
                if ( !hash[name] ) {
                    hash[name] = item_hash;
                }
                
                if (name_array.length > 1) {
                    item_hash.leaf = false;
                    item_hash.id = name;
                    name_array.shift();
                    this._setHashValue(hash,full_name,name_array,hash[name]);
                }
            }
            
            return hash;
        }
    });