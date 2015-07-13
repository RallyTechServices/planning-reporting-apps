Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container', itemId:'selector_box', layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    
    selected_target_program: null,
    selected_context: null,
    
    launch: function() {
        Rally.data.ModelFactory.registerTypes(['milestone'], Rally.data.WsapiModelFactory); 
        
        this._addTargetProgramSelector();

        if ( this.isExternal() ) {
            this._addProjectSelector();
        } else {
            this.selected_context = {
                workspace:this.getContext().getWorkspace()._ref,
                project:this.getContext().getProject()._ref
            };
            this._update();
        }
    },
    _addProjectSelector: function() {
        this.down('#selector_box').add({
            fieldLabel: 'Project',
            labelWidth: 45,
            xtype: 'rallyprojectpicker',
            showMostRecentlyUsedProjects: false,
            margin: 5,
            stateful: true,
            stateId: 'rally.technicalservices.timeline.project',
            stateEvents: ['change'],
            listeners: {
                scope: this,
                change: function(selector) {
                    var project = selector.getSelectedRecord();
                    this.selected_context = {
                        workspace:project.get('Workspace')._ref,
                        project:project.get('_ref')
                    };
                    this._update();
                }
            }
        });
    },
    _addTargetProgramSelector: function() {
        this.down('#selector_box').add({
            fieldLabel: 'Target Program:',
            labelWidth: 95,
            xtype: 'rallyfieldvaluecombobox',
            model: 'PortfolioItem',
            field: 'c_TargetProgram',
            margin: 5,
            listeners: {
                scope: this,
                change: function(selector) {
                    this.selected_target_program = selector.getValue();

                    this._update();
                }
            }
        });
    },
    
    _update: function() {
        var target_program = this.selected_target_program;
        var context = this.selected_context;
        if ( Ext.isEmpty(context) ) {
            this.logger.log("Missing project", context);
            return;
        }
        
        if ( this.timepipe ) { 
            this.timepipe.destroy();
            this.down('#display_box').removeAll();
        }

        var start = this._getMonthFor(new Date());
        var end = Rally.util.DateTime.add(start,"month",6);
        
        Deft.Promise.all([
            this._loadMilestonesBetweenDates(start, end, context),
            this._loadPIsBetweenDates(start, end, context)
        ], this).then({
            scope: this,
            success: function(results){
                var milestones = results[0];
                var pis = results[1];
                this.logger.log('found milestones:', milestones);
                this.logger.log('found portfolio items:', pis);
                
                //this._showTimePipe(start,end,milestones,"TargetDate");
                var milestones_to_show = this._getMilestonesForPIs(pis,milestones).then({
                    scope: this,
                    success: function(milestones) {
                        this.logger.log('Milestones:',milestones);
                        this.logger.log('PIs:',pis);
                        
                        var records = Ext.Array.merge(pis,milestones);
                        
                        this._showTimePipe(start,end,records);
                    }
                });
                
                
            },
            failure: function(msg) { this.down('#display_box').add({xtype:'container', html:msg, padding: 10}); }
        });
    },
    
    _getMilestonesForPIs: function(pis,milestones) {
        var deferred = Ext.create('Deft.Deferred');
        
        var milestones_by_oid = {};
        Ext.Array.each(milestones, function(milestone){
            milestones_by_oid[milestone.get('ObjectID')] = milestone;
        });
        
        var promises = [];
        
        var me = this;
        Ext.Array.each(pis, function(pi){
            if (pi.get('Milestones') && pi.get('Milestones').Count > 0 ) {
                promises.push(function() { 
                    return me._getMilestonesForPI(pi);
                });
            }
        });
        
        if (promises.length == 0 ) {
            deferred.resolve([]);
            return deferred.promise;
        } else {
            Deft.Chain.sequence(promises).then({
                scope: this,
                success: function(results) {
                    var results = Ext.Array.flatten(results);
                    var milestones_by_oid = {};
                    Ext.Array.each(results, function(result){
                        milestones_by_oid[result.get('ObjectID')] = result;
                    });
                    deferred.resolve(Ext.Object.getValues(milestones_by_oid));
                }
            });
        }
        return deferred.promise;
    },
    
    _getMilestonesForPI: function(pi) {
        var deferred = Ext.create('Deft.Deferred');
        pi.getCollection('Milestones').load({
            fetch: ['DisplayColor','FormattedID','Name','TargetDate','TargetProject'],
            callback: function(records, operation, success) {
                deferred.resolve(records);
            }
        });
        return deferred.promise;
    },
    
    _showTimePipe: function(start_date,end_date,records){
        this.logger.log("_showTimePipe", records);
        var container = this.down('#display_box');
        
        this.logger.log('container:', container.getHeight(),container.getWidth());
        this.logger.log('page     :', this.getHeight(),this.getWidth());
        
        this.timepipe = Ext.create('Rally.technicalservices.board.TimePipe',{
            margin: 25,
            start_date: start_date,
            end_date: end_date,
            records: records,
            renderIn: this.down('#display_box'),
            width: this.getWidth(),
            height: this.getHeight() - 50,
            show_date: true/*,
            listeners: {
                scope: this,
                clickMarker: this._showMilestoneInfo
            }*/
        });
    },
    _showMilestoneInfo: function(marker,milestone) {
        this.logger.log("clicked with ", marker, milestone);
        
        var dialog = Ext.create('Rally.ui.dialog.Dialog',{
            autoShow: true,
            draggable: true,
            closable: true,
            width: 300,
            title: milestone.get('Name')
         });
         
         dialog.add({
            xtype: 'rallygrid',
            storeConfig: {
                model:'PortfolioItem/Feature',
                filters: [{property:'Milestones.Name', operator: 'contains', value:milestone.get('Name')}]
            },
            columnCfgs: [{dataIndex:'FormattedID',text:'id'},{dataIndex:'Name',text:'Name'}]
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
    _loadMilestonesBetweenDates: function(start_date,end_date, context){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log("Fetching milestones between ", start_date, end_date);
        if ( typeof start_date === 'object' ) { 
            start_date = Rally.util.DateTime.toIsoString(start_date);
        }
        if ( typeof end_date === 'object' ) { 
            end_date = Rally.util.DateTime.toIsoString(end_date);
        }
        this.logger.log("Fetching milestones between ", start_date, end_date);

        var project_oid = context.project.replace(/.*\//,"");
        
        var target_date_filter = Rally.data.wsapi.Filter.and([
            { property: 'TargetDate', operator: '>', value: start_date },
            { property: 'TargetDate', operator: '<', value: end_date }
        ]);
        
        var target_project_filter = Rally.data.wsapi.Filter.or([
            { property: 'Projects.ObjectID', value: project_oid },
            { property: 'TargetProject', value: "" }
        ]);
        
        var filters = target_date_filter.and(target_project_filter);
        
        
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'Milestone',
            context: context,
            filters: filters,
            fetch: ['DisplayColor','FormattedID','Name','TargetDate','TargetProject'],
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
    },
    
    _loadPIsBetweenDates: function(start_date,end_date, context){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log("Fetching portfolio items between ", start_date, end_date);
        var me = this;
        
        if ( typeof start_date === 'object' ) { 
            start_date = Rally.util.DateTime.toIsoString(start_date);
        }
        if ( typeof end_date === 'object' ) { 
            end_date = Rally.util.DateTime.toIsoString(end_date);
        }
        this.logger.log("Fetching portfolio items between ", start_date, end_date);

        var project_oid = context.project.replace(/.*\//,"");
        
        var target_date_filter = Rally.data.wsapi.Filter.and([
            { property: 'PlannedEndDate', operator: '>', value: start_date },
            { property: 'PlannedEndDate', operator: '<', value: end_date }
        ]);
        
        var show_filter = Rally.data.wsapi.Filter.and([
            {property:'c_ShowOnTimeline', value: true }
        ]);
        
        var program_filter = Rally.data.wsapi.Filter.and([
            { property: 'c_TargetProgram', value: me.selected_target_program }
        ]);
        
        var filters = target_date_filter.and(show_filter);
        
        if ( !Ext.isEmpty(me.selected_target_program) ){
            filters = filters.and(program_filter);
        };
        
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'PortfolioItem',
            context: context,
            filters: filters,
            fetch: ['DisplayColor','FormattedID','Name','PlannedEndDate','Milestones'],
            sorters: { property: 'PlannedEndDate' },
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful && records.length > 0 ){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load data for portfolio items');
                    }
                }
            }
        });
        return deferred.promise;
    },
    isExternal: function(){
      return typeof(this.getAppId()) == 'undefined';
    }
});