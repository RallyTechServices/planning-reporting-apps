Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        this._getRecords("Release", ['Name','ReleaseDate']).then({
            scope: this,
            success: function(records){
                this.logger.log(records);
                Ext.create('Rally.technicalservices.board.RoadmapBoard',{
                    width: this.getWidth(),
                    height: this.getHeight(),
                    target: this.down('#display_box'),
                    records: records,
                    date_field: 'ReleaseDate',
                    margin: 15
                },this);
            },
            failure: function(error_message){
                alert(error_message);
            }
        });
    },
    _getRecords: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        
        var context = this.getContext();
        if ( model_name == "Release" ) {
            context = {
                projectScopeDown: false
            }
        }
        var defectStore = Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            autoLoad: true,
            context: context,
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