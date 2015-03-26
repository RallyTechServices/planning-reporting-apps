Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    
    scheduleableModel: 'PortfolioItem/Feature',
    dateField: 'PlannedEndDate',
    
    items: [
        {xtype:'container',itemId:'selector_box', margin: 5},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        this._addSelectors(this.down('#selector_box'));
    },
    
    _addSelectors: function(container) {
        container.add({ 
            xtype: 'tstagtreepicker',
            fieldLabel: 'Use Tags:',
            listeners: {
                scope: this,
                blur: function(picker) {
                    console.log("HA!",picker.getValue());
                    var filters = null;
                    if ( !Ext.isEmpty(picker.getValue()) ){
                        var values = picker.getValue().split(',');
                        
                        var filter_configs = Ext.Array.map(values,function(name){
                            return { property:'Tags.Name',operator:'contains',value:name };
                        });
                        filters = Rally.data.wsapi.Filter.or(filter_configs);
                    }
                    this._getRecords(this.scheduleableModel, ['Name',this.dateField], filters).then({
                        scope: this,
                        success: function(records){
                            this.logger.log('records',records);
                            this.down('#display_box').removeAll();
                            
                            Ext.create('Rally.technicalservices.board.RoadmapBoard',{
                                width: this.getWidth(),
                                height: this.getHeight(),
                                target: this.down('#display_box'),
                                records: records,
                                date_field: this.dateField,
                                listeners: {
                                    scope: this,
                                    clickMarker: this._showReleaseInfo
                                },
                                margin: 15
                            },this);
                        },
                        failure: function(error_message){
                            alert(error_message);
                        }
                    });
                }
            }
        });
    },
    
    _showReleaseInfo: function(marker,release) {
        this.logger.log("clicked with ", marker, release);
        
        var dialog = Ext.create('Rally.ui.dialog.Dialog',{
            autoShow: true,
            draggable: true,
            closable: true,
            width: 300,
            title: release.get('Name')
         });
         
         dialog.add({
            xtype: 'rallygrid',
            storeConfig: {
                model:'PortfolioItem/Feature',
                filters: [{property:'Release.Name', value:release.get('Name')}]
            },
            columnCfgs: [{dataIndex:'FormattedID',text:'id'},{dataIndex:'Name',text:'Name'}]
         });
    },
    
    _getRecords: function(model_name, model_fields, filters){
        var deferred = Ext.create('Deft.Deferred');
        
        if ( !filters ) {
            filters = [{property:'ObjectID',operator:'>',value:0}];
        }
        var context = {
            projectScopeDown: this.getContext().getProjectScopeDown()
        };
                
        if ( model_name == "Release" ) {
            context = {
                projectScopeDown: false
            }
        }
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters,
            autoLoad: true,
            context: context,
            sorters: [{property: 'Name'}],
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load store for model [' + model_name + '] and fields [' + model_fields.join(',') + ']');
                    }
                }
            }
        });
        return deferred.promise;
    }
});