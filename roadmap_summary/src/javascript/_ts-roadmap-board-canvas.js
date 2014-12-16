Ext.define('Rally.technicalservices.board.RoadmapBoard',{
    extend: 'Ext.container.Container',
    alias: 'widget.tsroadmapboard',
    scheduled_items: [], /* items that will show up in the quarter columns (e.g., releases) */
    config: {
        /*
         * @cfg {Ext.data.model} records The items to be placed on the timeboxes
         */
        records: [],
        /*
         * @cfg {String} date_field The field that holds the date used to determine placement
         * 
         */
        date_field: 'PlannedEndDate',
        /*
         * @cfg {Date} start_date  The date from which to start displaying quarters
         */
        start_date: new Date(),
        /*
         * @cfg {Number} margin
         */
        margin: 0
    },
    constructor: function(config){
        this.callParent(arguments);
        this.initConfig(config);
    },
    initComponent: function() {
        this.callParent(arguments);
        
        this.addEvents(
            /**
             * @event
             * Fired when a record marker is clicked on 
             * 
             * @param {Sprite} the text marker that was clicked
             * @param {Ext.data.Model} the record that the marker represents
             */
            'clickMarker'
        );

        this.height = this.height || 400;
        this.width = this.width || 800;
        this.margin = this.margin || 2;
        
        var timeboxes = this._createTimeboxes();
        
        this.canvas = Ext.create('Ext.draw.Component',{
            viewBox: false,
            width: this.width,
            height: this.height,
            items: timeboxes
        });
        
        this.container = Ext.create('Ext.container.Container', {
            width: this.width,
            height: this.height,
            items:[this.canvas]
        });
        
        this.target.add(this.container);
    },
    
    _createTimeboxes: function() {
        var timeboxes = [];
        var records_to_place = this.records;
        var year_start_date = this._getStartOfQuarter( this.start_date );
        
        for ( var i=0; i<3; i++ ) {
            var width = (this.width - ( 2* this.margin )) / 3  ;
            var height = this.height - ( 2 * this.margin );
            var x =  ( i * width) + this.margin;
            var y = 0 + this.margin;
            
            var start_date = Rally.util.DateTime.add(year_start_date,'month', 3*i);
            
            timeboxes.push(this._getQuarterTimebox(x,y,width,height,start_date,records_to_place));
        }
        
        return Ext.Array.flatten(timeboxes);
    },
    _getQuarterTimebox: function(x,y, width, height, start_date, records_to_place) {
        width = width - 5;
        var end_date = Rally.util.DateTime.add(start_date,"month",3);
        
        var records_in_quarter = [];
        Ext.Array.each( records_to_place,function(record){ 
            var record_date = record.get(this.date_field);

            if ( record_date > start_date && record_date < end_date ) {
                records_in_quarter.push(record);
            }
        },this);

        var quarter_timebox_columns = this._getQuarterTimeboxColumns(x,y,width,height,start_date,records_in_quarter);
        
        var timebox = Ext.create('Ext.draw.Sprite', {
            type:'rect',
            width: width,
            height: height,
            x: x,
            y: y,
            opacity: 0.5,
            'stroke-width': 2,
            margin: 5
        });
        return [ timebox, quarter_timebox_columns, this._getQuarterTimeboxHeader(x,y,width,start_date) ];
    },
    _getQuarterTimeboxHeader: function(x,y, width, start_date) {
        var height = 50;
        
        var header = Ext.create('Ext.draw.Sprite', {
            type:'rect',
            width: width,
            height: height,
            x: x,
            y: y,
            fill: '#5882FA',
            opacity: 1,
            'stroke-width': 2,
            margin: 5
        });
        
        var font_size = 24;
        var text = this._getQuarterForDate(start_date);
        var header_text = Ext.create( 'Ext.draw.Sprite', {
            type: 'text',
            text: text,
            x: x + width/2 - font_size,
            y: y + height/2, 
            fill: '#fff',
            font: this._getFont(font_size)
        } );
        
        var sub_headers = this._getQuarterTimeboxSubHeaders(x,y,width,100, start_date);
        
        return [ header, header_text, sub_headers ];
    },
    _getQuarterTimeboxSubHeaders: function(parent_x, parent_y, parent_width, parent_height, start_date){
        var y = parent_y + 0.5 * parent_height; 
        var width = 0.33333 * parent_width;
        var height = 0.5 * parent_height;
        
        var sub_headers = [];
        for ( var i=0; i<3; i++ ) {
            var x = parent_x + ( i * width );
            var month_start = Rally.util.DateTime.add(start_date, "month", i);
            
            sub_headers.push(Ext.create('Ext.draw.Sprite', {
                type:'rect',
                width: width,
                height: height,
                x: x,
                y: y,
                fill: '#5882FA',
                opacity: 1,
                'stroke-width': 2,
                margin: 5
            }));
            
            var text = Ext.util.Format.date(month_start,"M");
            var font_size = 20;
            sub_headers.push(Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: text,
                x: x + width/2 - font_size,
                y: y + height/2, 
                fill: '#fff',
                font: this._getFont(font_size)
            } ));
            
        }
        return sub_headers;
    },
    _getQuarterTimeboxColumns: function(parent_x, parent_y, parent_width, parent_height, start_date, records_to_place){
        var y = parent_y; 
        var width = 0.33333 * parent_width;
        var height = parent_height;
        
        var sub_columns = [];
        var record_marks = [];
        var start_marks_y = y + 100;
        
        for ( var i=0; i<3; i++ ) {
            var x = parent_x + ( i * width );
            //start_marks_y = start_marks_y + i*27; // shift down to keep from overlapping
            
            var month_start = Rally.util.DateTime.add(start_date, "month", i);
            var month_end = Rally.util.DateTime.add(month_start,"month",1);
            
            var records_in_month = [];
            
            Ext.Array.each(records_to_place,function(record){
                var record_date = record.get(this.date_field);
    
                if ( record_date > month_start && record_date < month_end ) {
                    records_in_month.push(record);
                }

            },this);
            
            var record_marks = Ext.Array.push( record_marks, this._getRecordMarks(x,start_marks_y,width,height,records_in_month));

            sub_columns.push(Ext.create('Ext.draw.Sprite', {
                type:'rect',
                width: width,
                height: height,
                x: x,
                y: y,
                stroke: 'white',
                fill: '#EFF5FB',
                opacity: 0.5,
                'stroke-width': 2,
                margin: 5
            }));
        }
        return [ sub_columns, record_marks];
    },
    _getRecordMarks: function(start_x,start_y,container_width, container_height, records_to_place){
        var me = this;
        
        var x = start_x + ( 0.25 * container_width);
        var y = start_y;
        
        var font_size = 14;
        var marks = [];
        Ext.Array.each(records_to_place,function(record){
            var text = record.get('Name');
            
            var x_text_start = x + 4 + font_size/8;
            var x_text_end = x + 4 + this._getTextWidth( text, font_size );
            
            y = this._getSafeY( x, x_text_end, y + font_size + 7, font_size );

            var text_sprite = Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: text,
                x: x_text_start,
                y: y, 
                fill: '#000',
                font: this._getFont(font_size),
                listeners: {
                    click: function(){
                        console.log('click',this,record);
                        me.fireEvent('clickMarker',this,record);
                    }
                }
            } );
            
            var marker_sprite = Ext.create('Ext.draw.Sprite',{
                type: 'circle',
                radius: font_size / 4,
                x: x,
                y: y-2,
                fill: 'green'
            });
            
            marks.push(marker_sprite);
            
            marks.push(text_sprite);
            this.scheduled_items.push( {x_text_start: x_text_start, x_text_end: x_text_end, y: y} );
            
//            marks.push(Ext.create('Ext.draw.Sprite',{
//                type: 'circle',
//                radius: font_size / 4,
//                x: x_text_end,
//                y: y-2,
//                fill: 'blue'
//            }));
            
        },this);
        
        return marks;
    },
    _getTextWidth: function( text, font_size ){
        return text.length * font_size/2;
    },
    _getFont: function(font_size) {
        var font_string = font_size + "px Arial";
        return font_string;
    },
    _getQuarterForDate: function getQuarter(d) {
      d = d || new Date(); // If no date supplied, use today
      var q = [1,2,3,4];
      return "Q" + q[Math.floor(d.getMonth() / 3)];
    },
    _getStartOfQuarter: function( check_date ) {
        var quarter_start_year = check_date.getFullYear();
        
        var quarter_start_months = [0, 3, 6, 9];
        var quarter_start_month = quarter_start_months[Math.floor(check_date.getMonth() / 3)];
        
        var quarter_start = new Date(quarter_start_year, quarter_start_month, 1);
        
        return quarter_start;
    },
    /*
     * check for overlapping text markers
     */
    _getSafeY: function( x_text_start,x_text_end, y, font_size ){
        //y + font_size + 7
        var safe = true;
        Ext.Array.each(this.scheduled_items,function(item){
            var test_x_text_start = item.x_text_start;
            var test_x_text_end = item.x_text_end;
            var test_y = item.y;
            
            if ( y < test_y + 5 && y > test_y - 5 ) {
                if ( x_text_start >= test_x_text_start && x_text_start <= test_x_text_end  ) {
                    safe = false;
                }
            }
        });
        
        var new_y = y;
        if ( !safe ) {
            new_y = this._getSafeY(x_text_start,x_text_end, y+font_size+7, font_size);
        }
        return new_y;
    }
});