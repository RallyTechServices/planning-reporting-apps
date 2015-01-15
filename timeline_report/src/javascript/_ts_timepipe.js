Ext.define('Rally.technicalservices.board.TimePipe',{
    extend: 'Ext.container.Container',
    alias: 'widget.tstimepipe',
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
        date_field: 'TargetDate',
        /*
         * @cfg {Date} start_date  The date from which to start displaying timeboxes
         */
        start_date: new Date(),
        /*
         * @cfg {Date} end_date  The date less than which display (one day more than what we want
         * to display for quarters and months (e.g., 1 jan to stop on 31 dec)
         */
        end_date: Rally.util.DateTime.add( new Date(), 'month', 1),
        /*
         * @cfg {String} granularity  What size segments to make 
         * 'day','month','quarter','year'
         * 
         * (only 'month' works right now)
         */
        granularity: 'month',
        
        /*
         * @cfg {Number} margin
         */
        margin: 0,
        /*
         * @cfg {Class} renderIn
         * 
         * Must use renderIn instead of .add because
         * we're playing with canvases
         * 
         */
        renderIn: null,
        /*
         * @cfg {Boolean} top_on_color
         * 
         * If the record has a color for its DisplayColor, then put on top
         */
        top_on_color: false,
        /*
         * @cfg {Boolean} show_date
         * 
         * Include a short form of the date with the text
         */
        show_date: false
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
        
        if ( this.renderIn === null ) {
            throw "Cannot create a TimePipe without assigning renderIn";
        }
        if ( this.granularity !== 'month' ) {
            throw "Cannot create TimePipe with any granularity other than 'month' right now";
        }

        this.height = this.height || 800;
        this.width = this.width || 1000;
        this.margin = this.margin || 2;
        
        var timepipe = this._createPipe();
        
        this.canvas = Ext.create('Ext.draw.Component',{
            viewBox: false,
            width: this.width,
            height: this.height,
            items: [timepipe]
        });
        
        this.container = Ext.create('Ext.container.Container', {
            width: this.width,
            height: this.height,
            items:[this.canvas]
        });
        
        this.renderIn.add(this.container);
    },
    _createPipe: function() {
        var margin = this.margin;
        
        var width = this.width - ( 2 * margin );
        var height = 50 ;
        
        var x = margin;
        var y = ( ( this.height - ( 2 * margin ) ) / 2 ) - height / 2;
        
        var timeboxes = this._createTimeboxes(width, height, x, y, this.records);
        
        var pipe = Ext.create('Ext.draw.Sprite', {
            type:'rect',
            width: width,
            height: height,
            x: x,
            y: y,
            opacity: 1,
            'stroke-width': 2,
            fill: '#0099FF'
        });
        
        return Ext.Array.flatten( [ pipe, timeboxes ] );
    },
    
    _createTimeboxes: function(parent_width,parent_height, parent_x, parent_y, records) {
        var timeboxes = [];
        var timebox_margin = 4;
        
        var start = this.start_date;
        var end = this.end_date;
        
        var granularity = this.granularity;
        
        var number_of_boxes = Rally.util.DateTime.getDifference(end,start,granularity);
        
        var check_date = start;
        
        var width = ( parent_width / number_of_boxes ) - 2*timebox_margin;
        var height = ( parent_height - 2*timebox_margin ) ;
        
        var record_markers = [];
        
        for ( var i=0; i<number_of_boxes; i++ ) {
            var x = parent_x + (i*width) + i*2*timebox_margin + timebox_margin;
            var y = parent_y + timebox_margin;
            
            timeboxes.push(
                Ext.create('Ext.draw.Sprite', {
                    type:'rect',
                    width: width,
                    height: height,
                    x: x,
                    y: y,
                    opacity: 1,
                    'stroke-width': 0,
                    fill: '#B2E0FF'
                })
            );
            
            timeboxes.push( this._getMonthNameMarker(check_date,width,height,x,y));
            
            var next_date = Rally.util.DateTime.add(check_date,granularity,1);
            var records_in_timebox = [];
            Ext.Array.each(records,function(record){
                var record_date = record.get(this.date_field);
                
                if ( record_date > check_date && record_date < Rally.util.DateTime.add(next_date,'minute',-30) ) {
                    records_in_timebox.push(record);
                }
            },this);
            record_markers.push( this._getRecordMarkers(check_date, width, height, x, y, records_in_timebox));
            
            check_date = next_date;
        }
        
        // put the lines on before text to prevent overlap
        Ext.Array.each(Ext.Array.flatten(record_markers), function(marker){
            if ( marker.type == 'rect') {
                timeboxes.push(marker);
            }
        });
        Ext.Array.each(Ext.Array.flatten(record_markers), function(marker){
            if ( marker.type != 'rect') {
                timeboxes.push(marker);
            }
        });
        return Ext.Array.flatten(timeboxes);
    },
    _getRecordMarkers: function(month_date, parent_width, parent_height, parent_x, parent_y, records) {
        var markers = [];
        var font_size = 14;

        Ext.Array.each(records,function(record){
            var percentage_of_month = this._getPercentageOfMonthBurned(month_date, record.get(this.date_field));
            var x = parent_x + ( percentage_of_month * parent_width );
            var y = parent_y + parent_height;
            var potential_text_y = y+40;

            var is_above = ( this.top_on_color && record.get('DisplayColor') );
            if  (is_above) {
                y = parent_y;
                potential_text_y = y-45;
            }
            
            var text = record.get('Name');

            if (this.show_date) {
                text = Ext.util.Format.date(record.get(this.date_field),'m/d')  + ":\n" + text;
            }
            
            var x_text_start = this._getCenteredTextX(text,font_size,x);
            var y_text_start = this._getSafeY( x_text_start, potential_text_y, text, font_size, is_above);

            var text_sprite = Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: text,
                x: x_text_start,
                y: y_text_start, 
                fill: '#000',
                font: this._getFont(font_size),
                fontSize: font_size
            } );
            
            var text_sprites = this._getSpritesFromTextSprite(text_sprite, x, record); // used for displaying

            
            var line_x = x;
            var line_y = y;
            var line_height = y_text_start - y - font_size;
            if  (is_above) {
                line_y = text_sprites[text_sprites.length-1].y + 7;
                line_height = y - y_text_start;
            }
            
            console.log("line for ", text);
            markers.push(this._getSafeLine(line_x, line_y, line_height, is_above));
            
            this.scheduled_items.push( text_sprite ); // used for looking for overlaps            
            markers.push(text_sprites);
            
        },this);
        return markers;
    },
    _getSafeLine: function(line_x, line_y, line_height, is_above) {
        var safe = true;
        var bbox = { x: line_x, y: line_y, width: 2, height: line_height };
        
        var line = {
            type:'rect',
            width: 2,
            height: line_height,
            x: line_x,
            y: line_y,
            opacity: 1,
            'stroke-width': 0,
            fill: '#B2E0FF'
        };
        
        Ext.Array.each(this.scheduled_items,function(item){
            var check_bbox = this._guessBBox(item.x, item.y, item.text, item.fontSize);
            
            if ( this._BBOverlap(bbox, check_bbox) ){
                safe = false;
                var start_x = line_x;
                var start_y = line_y;
                var first_bend_y = check_bbox.y;
                var first_bend_x = check_bbox.x + check_bbox.width + 2;
                var second_bend_y = check_bbox.y + check_bbox.height;
                var final_y = line_y + line_height;
                
                if ( !is_above ) {
                    first_bend_y = check_bbox.y - 10;
                    first_bend_x = check_bbox.x + check_bbox.width + 25;
                    second_bend_y = line_y + line_height - 5;
                    
                }
                
                line =  {
                    type  : "path",
                    path  : "M " + start_x + " " + start_y + " " + 
                            "L" + start_x + " " + first_bend_y + " " + 
                            "L" + first_bend_x + " " + first_bend_y + " " +
                            "L" + first_bend_x + " " + second_bend_y + " " + 
                            "L" + start_x + " " + second_bend_y + " " + 
                            "L" + start_x + " " + final_y,
                    opacity: 1,
                    'stroke-width': 2,
                    'stroke': '#B2E0FF'
                };
            }

        },this);
        
        console.log('line', line);
        
        console.log(safe);
        return Ext.create('Ext.draw.Sprite', line );
    },
    /*
     * Text with \n will not let you center the second line, so
     * let's break into an array of more than one.
     */
    _getSpritesFromTextSprite:function(text_sprite, x, record){
        var me = this;
        var text_array = text_sprite.text.split('\n');
        var sprites = [];
        
        var line_counter = 0;
        Ext.Array.each( text_array, function(line_text) {
            var subtext = Ext.util.Format.ellipsis(line_text, 15);
            
            var sub_width = this._getTextWidth(subtext, text_sprite.fontSize);
            var sub_x = this._getCenteredTextX(subtext,text_sprite.fontSize,x);
            
            sprites.push(Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: subtext,
                x: sub_x,
                y: text_sprite.y + ( line_counter * ( text_sprite.fontSize + 2 ) ), 
                fill: '#000',
                font: text_sprite.font,
                fontSize: text_sprite.fontSize,
                listeners: {
                    click: function(){
                        me.fireEvent('clickMarker',this,record);
                    }
                }
            } ));
            line_counter++;
            
        },this);
        
        return sprites;
    },
    _getCenteredTextX: function(text,font_size,x){
        var width = this._getTextWidth( text, font_size );
        var start = x - width/2;
        if ( start < this.margin ) { start = this.margin; }
        return start;
    },
    _getMonthNameMarker:function(month_date, parent_width, parent_height, parent_x, parent_y) {
        var font_size = 24;
        var text = Ext.util.Format.date(month_date,'M');
        
        var x = ( parent_x + parent_width/2 ) - font_size;
        var y = parent_y + parent_height/2;
        
        return Ext.create( 'Ext.draw.Sprite', {
            type: 'text',
            text: text,
            x: x,
            y: y, 
            fill: '#000',
            font: this._getFont(font_size)
        } );
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
      var q = [4,1,2,3];
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
    _getSafeY: function( potential_x, potential_y, text, font_size, is_above ){
        var safe = true;
        var bbox = this._guessBBox(potential_x, potential_y, text, font_size);
        
        var y = potential_y;
        var x = potential_x;
        
        Ext.Array.each(this.scheduled_items,function(item){
            var check_bbox = this._guessBBox(item.x, item.y, item.text, item.fontSize);
            
            if ( this._BBOverlap(bbox, check_bbox) ){
                safe = false;
            }

        },this);
        
        var new_y = y;
        if ( !safe ) {
            var possible_y = y + bbox.height + 7;
            if (is_above) {
                possible_y = y - bbox.height - 7;
            }
            new_y = this._getSafeY(x, possible_y, text, font_size, is_above);
        }
        return new_y;
    },
    _BBOverlap: function( bbox_a, bbox_b ) {
        var tolerance = 25;
        
        var a_left_of_b =  ( bbox_a.x + bbox_a.width < bbox_b.x + tolerance );
        var a_right_of_b = ( bbox_a.x > bbox_b.x + bbox_b.width + tolerance );
        var a_above_b = ( bbox_a.y + bbox_a.height < bbox_b.y );
        var a_below_b = ( bbox_a.y > bbox_b.y + bbox_b.height);
        
        //console.log( bbox_a, bbox_b ); 
        //console.log( " -- ", a_left_of_b , a_right_of_b , a_above_b , a_below_b );
        return !(a_left_of_b || a_right_of_b || a_above_b || a_below_b ) ;
    },
    _guessBBox: function( x, y, text, font_size ) {
        var width = 0;
        var line_counter = 0;
        
        var text_array = text.split('\n');
        
        Ext.Array.each( text_array, function(subtext) {
            line_counter++;
            var sub_width = this._getTextWidth(subtext, font_size);
            if ( sub_width > width ) { width = sub_width; }
        },this);
        
        var height = line_counter * ( font_size + 3 );
                
        return { x: x, y: y, width: width, height: height }
    },
    _getPercentageOfMonthBurned: function(month_date,check_date){
        var day_ordinal = check_date.getDate();
        var last_day_of_month = Rally.util.DateTime.add(Rally.util.DateTime.add(month_date,'month',1),'day',-1);
        var last_day_ordinal = last_day_of_month.getDate();
        
        var percentage = day_ordinal / last_day_ordinal;
                
        return percentage;
    }
});