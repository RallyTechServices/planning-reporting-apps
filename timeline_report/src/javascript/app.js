Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        console.log('types:', Rally.data.ModelTypes.types);
        Rally.data.ModelFactory.registerTypes(['milestone'], Rally.data.WsapiModelFactory); 
        
        var start = this._getMonthFor(new Date());
        var end = Rally.util.DateTime.add(start,"month",6);
        
        this._loadMilestonesBetweenDates(start, end).then({
            scope: this,
            success: function(milestones){
                this.logger.log("milestones:", milestones);
                this._showTimePipe(start,end,milestones,"TargetDate");
            },
            failure: function(msg) { this.down('#display_box').add({xtype:'container', html:msg}); }
        });
    },
    _showTimePipe: function(start_date,end_date,records,date_field_name){
        this.logger.log("_showTimePipe");
        Ext.create('Rally.technicalservices.board.TimePipe',{
            margin: 25,
            start_date: start_date,
            end_date: end_date,
            records: records,
            date_field: date_field_name,
            renderIn: this.down('#display_box'),
            width: this.getWidth(),
            height: this.getHeight() - 50,
            top_on_color: true
        });
    },
    _getMonthFor: function(date_in_month) {
        this.logger.log("Shifting to beginning of month from:", date_in_month);
        
        date_in_month.setHours(0);
        date_in_month.setMinutes(0);
        date_in_month.setSeconds(0);
        
        var day_in_month = date_in_month.getDate()-1;
        this.logger.log("Day In Month", day_in_month);
        
        var beginning_of_month = Rally.util.DateTime.add(date_in_month, 'day', -1*day_in_month);
        
        return beginning_of_month;
    },
    _loadMilestonesBetweenDates: function(start_date,end_date){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log("Fetching milestones between ", start_date, end_date);
        if ( typeof start_date === 'object' ) { 
            start_date = Rally.util.DateTime.toIsoString(start_date);
        }
        if ( typeof end_date === 'object' ) { 
            end_date = Rally.util.DateTime.toIsoString(end_date);
        }
        this.logger.log("Fetching milestones between ", start_date, end_date);

        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'Milestone',
            filters: [
                { property: 'TargetDate', operator: '>', value: start_date },
                { property: 'TargetDate', operator: '<', value: end_date }
            ],
            fetch: ['DisplayColor','FormattedID','Name','TargetDate'],
            sorters: { property: 'TargetDate' },
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load data for milestones]');
                    }
                }
            }
        });
        return deferred.promise;
    }
});