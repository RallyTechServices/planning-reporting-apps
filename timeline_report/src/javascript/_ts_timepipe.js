Ext.define('Rally.technicalservices.board.TimePipe',{
    extend: 'Ext.container.Container',
    alias: 'widget.tstimepipe',
    config: {
        /*
         * @cfg {Ext.data.model} records The items to be placed on the timeboxes
         */
        records: [],
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
         * @cfg {Boolean} show_date
         * 
         * Include a short form of the date with the text
         */
        show_date: false,
        
        marker_font_size: 12,
        
        marker_ellipsis_length: 45, 
        
        outline_text: false, 
        
        month_font_size:  18,
        
        scheduled_items: [] /* items that will show up in the quarter columns (e.g., releases) */
    },
    initComponent: function() {
        this.callParent(arguments);
        this.scheduled_items = [];
        
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

        this.renderIn.removeAll();
        
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
        return this;
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
                var record_date = this._getDateFromRecord(record);
                
                if ( record_date >= check_date && record_date <= Rally.util.DateTime.add(next_date,'seconds',-5) ) {
                    records_in_timebox.push(record);
                }
            },this);
            
            //record_markers.push( this._getRecordMarkers(check_date, width, height, x, y, records_in_timebox));
            record_markers.push( this._getDateMarkers(check_date, width, height, x, y, records_in_timebox));
            
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
    
    _getDateFromRecord: function(record) {
        var type = record.get('_type').replace(/\/.*$/,'');
        
        var date_fields_for_record = {
            'portfolioitem': 'PlannedEndDate',
            'milestone'    : 'TargetDate'
        }
        return record.get(date_fields_for_record[type]);
    },
    
    _isAboveLine: function(record) {
        return record.get('_type') == 'milestone';
    },

    /*
     * returns a hash where key = date, value = array or records on that date
     */
    _getRecordsByDate: function(records) {
        var records_by_date = {};
        Ext.Array.each(records, function(record) {
            var record_date = this._getDateFromRecord(record);
            if ( Ext.isEmpty(records_by_date[record_date]) ) { records_by_date[record_date] = []; } 
            records_by_date[record_date].push(record);
        },this);
        return records_by_date;
    },
    
    /*
     * clustered by date (if on same day)
     * 
     */
    _getDateMarkers: function(month_date, parent_width, parent_height, parent_x, parent_y, records) {
        var markers = [];
        var font_size = this.marker_font_size;

        var records_by_date = this._getRecordsByDate(records);
        
        console.log('records by date:', records_by_date);
        
        var text_boxes = [];
        var markers = [];
        
        Ext.Object.each(records_by_date, function(key, record_array){
            var record_date = new Date(key);
            var is_above = this._isAboveLine(record_array[0]);

            var percentage_of_month = this._getPercentageOfMonthBurned(month_date,record_date);
            var x = parent_x + ( percentage_of_month * parent_width );
            var y = parent_y + parent_height;
            var potential_text_y = y+40;
            if  (is_above) {
                y = parent_y;
                potential_text_y = y-45;
            }
            
            var text = Ext.Array.map(record_array,function(record){ return record.get("Name"); }).join('\n');
            if (this.show_date) {
                text = Ext.util.Format.date(record_date,'m/d')  + ":\n" + text;
            }
            var x_text_start = this._getCenteredTextX(text,font_size,x);
            var y_text_start = this._getSafeY( x_text_start, potential_text_y, text, font_size, is_above);

            var text_sprite = Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: text,
                x: x_text_start,
                y: y_text_start,
                x_center: x,
                fill: '#000',
                font: this._getFont(font_size),
                fontSize: font_size
            } );
            
            var text_sprites = this._getSpritesFromTextSprite(text_sprite, x); // used for displaying
            
            var line_x = x;
            var line_y_start = y;
            var line_y_end = y_text_start - font_size;
            if  (is_above) {
                line_y_start = text_sprites[text_sprites.length-1].y + 7;
                line_y_end = y;
            }
            
            // For seeing what the bbox is giving us
            if ( this.outline_text ) {
                markers.push(this._getBoxAroundText(text_sprite, x));
            }
            
            markers.push(this._getSafeLine(line_x, line_y_start, line_y_end, is_above, text_sprite));
            
            this.scheduled_items.push( text_sprite ); // used for looking for overlaps            
            markers.push(text_sprites);
        },this);
       
        return markers;
    },
    
    _getRecordMarkers: function(month_date, parent_width, parent_height, parent_x, parent_y, records) {
        var markers = [];
        var font_size = this.marker_font_size;

        Ext.Array.each(records,function(record){
            var percentage_of_month = this._getPercentageOfMonthBurned(month_date, this._getDateFromRecord(record));
            var x = parent_x + ( percentage_of_month * parent_width );
            var y = parent_y + parent_height;
            
            var potential_text_y = y+40;

            var is_above = this._isAboveLine(record);
            if  (is_above) {
                y = parent_y;
                potential_text_y = y-45;
            }
            
            var text = record.get('Name');

            if (this.show_date) {
                text = Ext.util.Format.date(this._getDateFromRecord(record),'m/d')  + ":\n" + text;
            }
            
            var x_text_start = this._getCenteredTextX(text,font_size,x);
            var y_text_start = this._getSafeY( x_text_start, potential_text_y, text, font_size, is_above);

            var text_sprite = Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: text,
                x: x_text_start,
                y: y_text_start,
                x_center: x,
                fill: '#000',
                font: this._getFont(font_size),
                fontSize: font_size
            } );
            
            var text_sprites = this._getSpritesFromTextSprite(text_sprite, x); // used for displaying
            
            var line_x = x;
            var line_y_start = y;
            var line_y_end = y_text_start - font_size;
            if  (is_above) {
                line_y_start = text_sprites[text_sprites.length-1].y + 7;
                line_y_end = y;
            }
            
            // For seeing what the bbox is giving us
            if ( this.outline_text ) {
                markers.push(this._getBoxAroundText(text_sprite, x));
            }
            
            //markers.push(this._getSafeLine(line_x, line_y_start, line_y_end, is_above, text_sprite));
            
            this.scheduled_items.push( text_sprite ); // used for looking for overlaps            
            markers.push(text_sprites);
            
        },this);
        return markers;
    },
    
    _getBoxAroundText: function(item, center_x) {
        var bbox = this._guessBBox(center_x, item.y, item.text, item.fontSize);
        
        var x0 = bbox.x;
        var y0 = bbox.y;
        
        var y1 = y0 + bbox.height;
        var x1 = x0 + bbox.width;
        
        var line = {
            type  : "path",
            path  : "M " + x0 + " " + y0 + " " + 
                    "L" + x0 + " " + y1 + " " +
                    "L" + x1 + " " + y1 + " " +
                    "L" + x1 + " " + y0 + " " +
                    "L" + x0 + " " + y0 ,
            opacity: 1,
            'stroke-width': 2,
            'stroke': '#ccc'
        };
                
        return line;
        
    },
    
    _getSafeLine: function(line_x, line_y_start, line_y_end, is_above, target_item) {
        var safe = true;
        var bbox = { x: line_x, y: line_y_start, width: 2, height: line_y_end - line_y_start };
        
        var start_x = line_x;
        var start_y = line_y_start;
        var end_y = line_y_end;
        var line = {
            type  : "path",
            path  : "M " + start_x + " " + start_y + " " + 
                    "L" + start_x + " " + end_y,
            opacity: 1,
            'stroke-width': 2,
            'stroke': '#B2E0FF'
        };
        
        Ext.Array.each(this.scheduled_items,function(item){
            // needs to have line_x be the center of the item.  hmm.
            // for under the timeline, the text box y is the upper limit
            var check_bbox = this._guessBBox(item.x_center, item.y, item.text, item.fontSize);
        
            if ( this._BBOverlap(bbox, check_bbox) ){
                safe = false;
                var text_right  = check_bbox.x + check_bbox.width;
                var text_left   = check_bbox.x + 2;
                var text_top    = check_bbox.y;
                var text_bottom = check_bbox.y + check_bbox.height + 2;
                
                start_x = line_x;
                start_y = line_y_start;
                end_y = line_y_end;

                var first_bend_y = (text_top >= start_y) ? text_top : start_y;
                var first_bend_x = (text_right > line_x ) ? text_right + 4: line_x;
                var second_bend_y = (text_bottom < end_y) ? text_bottom : end_y;
                var final_y = end_y;
                
                if ( is_above ) {
                    text_top = check_bbox.y;
                    text_bottom = check_bbox.y + check_bbox.height;
                    
                    first_bend_y = (text_top > start_y) ? text_top : start_y + 2;
                    second_bend_y = (text_bottom < end_y) ? text_bottom : end_y - 2;
                    line.stroke = is_above;
                }
                line.path = "M " + start_x + " " + start_y + " " + 
                            "L" + start_x + " " + first_bend_y + " " + 
                            "L" + first_bend_x + " " + first_bend_y + " " +
                            "L" + first_bend_x + " " + second_bend_y + " " + 
                            "L" + start_x + " " + second_bend_y + " " + 
                            "L" + start_x + " " + final_y;
            }

        },this);
        
        
        return Ext.create('Ext.draw.Sprite', line );
    },
    /*
     * Text with \n will not let you center the second line, so
     * let's break into an array of more than one.
     */
    _getSpritesFromTextSprite:function(text_sprite, x){
        var me = this;
        var text_array = text_sprite.text.split('\n');
        var sprites = [];
        
        var line_counter = 0;
        Ext.Array.each( text_array, function(line_text) {
            var subtext = Ext.util.Format.ellipsis(line_text, this.marker_ellipsis_length);
            
            var sub_box = this._getDimensions(subtext, text_sprite.fontSize);
            var sub_width = sub_box.w;
            
            var sub_x = this._getCenteredTextX(subtext,text_sprite.fontSize,x);
            //var sub_x = x;
                        
            sprites.push(Ext.create( 'Ext.draw.Sprite', {
                type: 'text',
                text: subtext,
                x: sub_x,
                y: text_sprite.y + ( line_counter * ( text_sprite.fontSize + 2 ) ), 
                fill: '#000',
                font: text_sprite.font,
                fontSize: text_sprite.fontSize
            } ));
            line_counter++;
            
        },this);
        
       return sprites;
    },
    _getCenteredTextX: function(text,font_size,x){        
        var width = this._getDimensions( text, font_size ).w;
        var start = x - width/2;
        if ( start < this.margin ) { start = this.margin; }
        return start;
    },
    _getMonthNameMarker:function(month_date, parent_width, parent_height, parent_x, parent_y) {
        var font_size = this.month_font_size;
        var text = Ext.util.Format.date(month_date,'M');
        
        var x = ( parent_x + parent_width/2 ) - font_size;
        var y = parent_y + parent_height/2;
        
        console.log(text, parent_x, parent_y);
        
        return Ext.create( 'Ext.draw.Sprite', {
            type: 'text',
            text: text,
            x: x,
            y: y, 
            fill: '#000',
            font: this._getFont(font_size)
        } );
    },
    
    _getDimensions: function( text, font_size){        
        var div = document.createElement('span');
        div.innerHTML = text;
        
        document.body.appendChild(div);
        
        var el = Ext.get(div);
        el.setStyle('margin',0);
        el.setStyle('paddding',0);
        el.setStyle('font', this._getFont(font_size));
        
        var height = el.getHeight();
        var width = el.getWidth();
        
        el.destroy();

        return { w: width, h: height };
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
        // guess bbox starts from a center x, not the item's x, so shift the x
        var dim = this._getDimensions(text, font_size);
        var bbox = this._guessBBox(potential_x + (dim.w/2), potential_y, text, font_size);

        var x = potential_x;
        var delta_y = 0;
        
        Ext.Array.each(this.scheduled_items,function(item){
            var check_dim = this._getDimensions(item.text,font_size);
            var check_bbox = this._guessBBox(item.x + (check_dim.w/2), item.y, item.text, item.fontSize);
                        
            if ( this._BBOverlap(bbox, check_bbox) ){
                var delta = 0;
                if ( is_above ) {
                    delta = -5;
                    //delta = ( check_bbox.y - check_bbox.height ) - t - 5;
                } else {
                    delta = check_bbox.y - (potential_y - bbox.height) + 10;
                    if ( delta <= 0 ) { delta = 15; }
                }
                if ( Math.abs(delta) > Math.abs(delta_y) ) {
                    delta_y = delta;
                }
                safe = false;
            }

        },this);
        
        var new_y = potential_y;
        if ( !safe ) {
            var possible_y = potential_y +  delta_y;
            new_y = this._getSafeY(x, possible_y, text, font_size, is_above);
        }
        return new_y;
    },
    _BBOverlap: function( bbox_a, bbox_b ) {
        var tolerance = 5;
        
        var a_left_of_b =  ( bbox_a.x + bbox_a.width < bbox_b.x - tolerance );
        var a_right_of_b = ( bbox_a.x > bbox_b.x + bbox_b.width + tolerance );
        var a_above_b = ( bbox_a.y + bbox_a.height < bbox_b.y );
        var a_below_b = ( bbox_a.y > bbox_b.y + bbox_b.height);
        
        return !(a_left_of_b || a_right_of_b || a_above_b || a_below_b );
    },
    
    _guessBBox: function( x, y, text, font_size ) {
        var width = 0;
        var line_counter = 0;
        var x0 = x;
            
        var text_array = text.split('\n');
        
        Ext.Array.each( text_array, function(subtext) {
            line_counter++;
            var subtext = Ext.util.Format.ellipsis(subtext, this.marker_ellipsis_length);
            var sub_box = this._getDimensions(subtext, font_size);
            
            var sub_width = sub_box.w;
            var sub_x = this._getCenteredTextX(subtext,font_size,x);
            //var sub_x = x;
            
            if ( sub_width > width ) { 
                x0 = sub_x;
                width = sub_width; 
            }
        },this);
        
        var height = line_counter * ( font_size + 5 );
        var y0 = y - (font_size);
        return { x: x0, y: y0, width: width, height: height }
    },
    
    _getPercentageOfMonthBurned: function(month_date,check_date){
        var day_ordinal = check_date.getDate();
        var last_day_of_month = Rally.util.DateTime.add(Rally.util.DateTime.add(month_date,'month',1),'day',-1);
        var last_day_ordinal = last_day_of_month.getDate();
        
        var percentage = day_ordinal / last_day_ordinal;
                
        return percentage;
    }
});