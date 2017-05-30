/**
 * MetroUI-arrange-tile
 */
//闭包限定命名空间
(function ($) {
    $.fn.extend({
        "arrange_tile": function (options) {
            //默认参数
            var defaluts = {
                //tile相关属性
                tile_margin: 5,
                tile_halfsize: 70,
                tile_size: 150,
                tile_medium: 310,
                tile_big: 470,
                tile_large: 630,
                tile_mdfactor: 1.25,
                tile_outlinesize: 3,
                tile_groupmargin: 80,

                //电脑tile尺寸
                col_width : 'auto',
                //手机tile尺寸
                m_col_width : 'auto',
                //列数
                col_num : 'auto',
                //定位方式：absolute，float（因为float高的div在中间排版会乱所以只能按高度从大到小排序）
                locate_mode : 'absolute',
                //没有给定权值的时候的加权方式： dom（节点顺序）（没写呢,b2s（大到小）,s2b（小到大））
                default_weighting_mode : 'dom',
                //使用权进行排序
                arr_use_weight : true,
                
                //最小的tile是tile_halfsize的多少倍，默认是2倍（默认最小是tile_size），长或宽小于2倍的不会自动创建
                min_tile_size : 2,
                //tiles_wrap定义包裹tiles的div
                tiles_wrap : '<section id="muat_tiles_warp"><section>',
                //tiles对于包裹tiles的tiles_wrap的对齐方式，center，right，left
                tiles_align : 'center',
                //补齐的tile
                create_tile_class : 'tile',
                create_tile_content : '这里少一个tile哦！',
                fill_last_col : true
            };
            var opts = null;
            var tiles_info = null;
            var $tile_container = $(this);
            var $tiles_wrap = null;
            var $tiles = $(this).find('> [class*="tile"]');
            // width不包括padding，innerWidth包括padding
            var tile_container_width = null;
            //检测用户传进来的参数是否合法
            if (!isValid(options)){
                console.log('arrange_tile的参数不合法');
                return ;
            }

            opts = $.extend({}, defaluts, options); //使用jQuery.extend 覆盖插件默认参数
            tile_container_width = opts.locate_mode === 'absolute' ? $tile_container.innerWidth() : $tile_container.width();
            $tiles_wrap = $($(this).prepend(opts.tiles_wrap)[0]);
            opts.col_width = opts.col_width === 'auto' ? get_col_width(opts) : opts.col_width;
            opts.m_col_width = opts.m_col_width === 'auto' ? get_m_col_width(opts) : opts.m_col_width;
            opts.is_small_screen = $(window).width() < 800 ? true :false;
            opts.col_num = opts.col_num === 'auto' ? get_col_num(tile_container_width, opts) : opts.col_num;
            
            
            // 判断定位方式
            if (opts.locate_mode === 'absolute') {
                $(this).css('position', 'relative');
            }
            // 判断对齐方式
            switch(opts.tiles_align){
                case 'center':
                    $tiles_wrap.css('left',(tile_container_width - (opts.is_small_screen ? opts.col_num*opts.m_col_width : opts.col_num*opts.col_width))/2 + 'px');
                    break;
                case 'right':
                    $tiles_wrap.css('right','0');
                    break;
                case 'left':
                    $tiles_wrap.css('left','0');
                    break;
            }
            // 获取tiles的信息
            tiles_info = calc_tile_scale_and_weight($tiles, opts);
            // 进行排列
            do_arrange_tile($tiles_wrap, $tiles, tiles_info, opts);


            $(window).resize(function(){
                
            });
        }
    });
    
    
    // 私有方法，检测参数是否合法
    function isValid(options) {
        return !options || (options && typeof options === "object") ? true : false;
    }
    /*
        贴的顺序从左上开始，到没有瓷砖结束。
    */
    function do_arrange_tile($tiles_wrap, $tiles, tiles_info, opts){
        // 1.构建"墙面"数组
        var wall = [];
        var status = {
            'notiled' : 0,
            'tiled' : 1,
            'nomatch' : 2
        }
        var max_row_num = get_max_row_num(tiles_info);
        for (var x = 0; x < opts.col_num; x++) {
            wall[x] = [];
            for (var y = 0; y < max_row_num; y++) {
                wall[x][y] = status.notiled;
            }
        }
        wall.x_length = wall.length;
        wall.y_length = wall[0].length;
        // 2.贴瓷砖
        while(true){
            var result = stick_tile_on_wall(wall, status, tiles_info, opts);
            $tiles_wrap.append(result.$tile);
            if (result.finish) break;
        }
    }

    // 将瓷砖贴到墙上
    function stick_tile_on_wall(wall, status, tiles_info, opts){
        // 查找第一个空闲的位置
        var notiled_pos = find_first_notiled(wall, status);
        // 计算空闲大小
        var notiled_size = get_notiled_size(notiled_pos, wall, status);
        // 墙面数组填充大小
        var fill_size = {x:0,y:0}
        // 返回的瓷砖
        var result = {$tile:null, finish:false};
        if (tiles_info.length > 0) {
            // 还有瓷砖，寻找合适的瓷砖
            var tile_num = find_suitable_tile(notiled_size, tiles_info);
            if (tile_num === -1) {
                notiled_size.y = get_tiled_size({x:notiled_pos.x-1,y:notiled_pos.y}, wall, status).y;
                // 空闲区域的x和y都比min_tile_size大才创建
                fill_size.x = notiled_size.x;
                fill_size.y = notiled_size.y;
                if (notiled_size.x >= opts.min_tile_size && notiled_size.y >= opts.min_tile_size) {
                    result.$tile = create_tile(notiled_size, opts.create_tile_class, opts.create_tile_content);
                }
            }else{
                fill_size.x = tiles_info[tile_num].size.x;
                fill_size.y = tiles_info[tile_num].size.y;
                result.$tile = $(tiles_info[tile_num].dom);
                tiles_info.splice(tile_num,1);
            }
        }else if(opts.fill_last_col && notiled_pos.x !== 0){
            // 没有瓷砖，需要处理最后一行并且最后一行有空位
            notiled_size.y = get_tiled_size({x:notiled_pos.x-1,y:notiled_pos.y}, wall, status).y;
            if (notiled_size.x >= opts.min_tile_size && notiled_size.y >= opts.min_tile_size) {
                // 最后一行要添加瓷砖
                fill_size.x = opts.min_tile_size;
                fill_size.y = opts.min_tile_size;
                result.$tile = create_tile({x:opts.min_tile_size,y:opts.min_tile_size}, opts.create_tile_class, opts.create_tile_content);
            }else{
                // 最后一行不添加瓷砖
                fill_size.x = notiled_size.x;
                fill_size.y = notiled_size.y;
                result.finish = true;
            }
        }else{
            result.finish = true;
        }
        // 对墙面数组赋值
        for (var x = notiled_pos.x, end_x = notiled_pos.x + fill_size.x; x < end_x; x++) {
            for (var y = notiled_pos.y, end_y = notiled_pos.y + fill_size.y; y < end_y; y++) {
                wall[x][y] = status.tiled;
            }
        }
        // 返回瓷砖
        if (opts.locate_mode === 'absolute') {
            if (result.$tile !== null) {
                result.$tile.css({
                    position : 'absolute',
                    float : 'none',
                    left : (opts.is_small_screen === true ? notiled_pos.x * opts.m_col_width : notiled_pos.x * opts.col_width)+ 'px',
                    top : (opts.is_small_screen === true ? notiled_pos.y * opts.m_col_width : notiled_pos.y * opts.col_width)+ 'px',
                });
            }
        }
        return result;
    }

    // 找出有多少列
    function get_col_num(tile_container_width, opts){
        // 使用floor：列数少了没事，多了排版会有问题
        var col_num = opts.is_small_screen ? Math.floor(tile_container_width/opts.m_col_width) : Math.floor(tile_container_width/opts.col_width);
        return col_num - (col_num % opts.min_tile_size);
    }

    // 给每个tile计算比例大小和权值
    function calc_tile_scale_and_weight($tiles, opts){
        var tiles_arr = [];
        var default_weight = $tiles.length;
        $tiles.each(function(){
            var tile = {};
            tile.dom = this;
            tile.size = get_tile_scale($(this));
            tile.weight = $(this).attr('mat-weight') ? $(this).attr('mat-weight') : default_weight--;
            if (tile.size.x <= opts.col_num && tile.size.x >= opts.min_tile_size) {
                tiles_arr.push(tile);
            }
        });
        if (opts.locate_mode === 'absolute') {
            return tiles_arr.sort(function(o, p){
                // weight降序排列
                return o.weight > p.weight ? -1 : 1;
            });
        }
        if (opts.locate_mode === 'float') {
            return tiles_arr.sort(function(o, p){
                // size.y降序排列
                return o.size.y > p.size.y ? -1 : 1;
            });
        }
    }

    // 获取tile的比例大小
    function get_tile_scale($tile){
        var tile_class = $tile.attr('class');
        var tile_scale = {};
        tile_scale.x = 2;
        tile_scale.y = 2;
        if (tile_class.search('tile') !== -1) {
            
            if (tile_class.search('small-tile') !== -1) {
                tile_scale.x = 1;
                tile_scale.y = 1;
            }

            if (tile_class.search('wide-tile') !== -1) {
                tile_scale.x = 4;
                tile_scale.y = 2;
            }

            if (tile_class.search('wide-tile-v') !== -1) {
                tile_scale.y = 4;
                tile_scale.x = 2;
            }

            if (tile_class.search('large-tile') !== -1) {
                tile_scale.x = 4;
                tile_scale.y = 4;
            }

            if (tile_class.search('big-tile') !== -1) {
                tile_scale.x = 6;
                tile_scale.y = 6;
            }

            if (tile_class.search('super-tile') !== -1) {
                tile_scale.x = 8;
                tile_scale.y = 8;
            }
        }

        if (tile_class.search('tile-small') !== -1) {
            tile_scale.x = 1;
            tile_scale.y = 1;
        }
        if (tile_class.search('tile-wide') !== -1) {
            tile_scale.x = 4;
            tile_scale.y = 2;
        }
        if (tile_class.search('tile-large') !== -1) {
            tile_scale.x = 4;
            tile_scale.y = 4;
        }
        if (tile_class.search('tile-big') !== -1) {
            tile_scale.x = 6;
            tile_scale.y = 6;
        }
        if (tile_class.search('tile-super') !== -1) {
            tile_scale.x = 8;
            tile_scale.y = 8;
        }
        if (tile_class.search('tile-small-x') !== -1) {
            tile_scale.x = 1;
        }
        if (tile_class.search('tile-square-x') !== -1) {
            tile_scale.x = 2;
        }
        if (tile_class.search('tile-wide-x') !== -1) {
            tile_scale.x = 4;
        }
        if (tile_class.search('tile-large-x') !== -1) {
            tile_scale.x = 4;
        }
        if (tile_class.search('tile-big-x') !== -1) {
            tile_scale.x = 6;
        }
        if (tile_class.search('tile-super-x') !== -1) {
            tile_scale.x = 8;
        }
        if (tile_class.search('tile-small-y') !== -1) {
            tile_scale.y = 1;
        }
        if (tile_class.search('tile-square-y') !== -1) {
            tile_scale.y = 2;
        }
        if (tile_class.search('tile-wide-y') !== -1) {
            tile_scale.y = 4;
        }
        if (tile_class.search('tile-large-y') !== -1) {
            tile_scale.y = 4;
        }
        if (tile_class.search('tile-big-y') !== -1) {
            tile_scale.y = 6;
        }
        if (tile_class.search('tile-super-y') !== -1) {
            tile_scale.y = 8;
        }
        return tile_scale;
    }

    

    function find_first_notiled(wall, status){
        for (var y = 0; y < wall.y_length; y++) {
            for (var x = 0; x < wall.x_length; x++) {
                if (wall[x][y] === status.notiled) {
                    return {x:x,y:y};
                }
            }
        }
    }
    function get_notiled_size(notiled_pos, wall, status){
        var notiled_size_x = 0;
        var notiled_size_y = 0;
        for (var x = notiled_pos.x; x < wall.x_length; x++) {
            if (wall[x][notiled_pos.y] === status.notiled) {
                notiled_size_x++
                if (notiled_size_x >= 8) {
                    break;
                }
            }
        }
        for (var y = notiled_pos.y; y < wall.y_length; y++) {
            if (wall[notiled_pos.x][y] === status.notiled) {
                notiled_size_y++
                if (notiled_size_y >= 8) {
                    break;
                }
            }
        }
        return {x:notiled_size_x, y:notiled_size_y};
    }
    function get_tiled_size(pos, wall, status){
        var tiled_size_x = 0;
        var tiled_size_y = 0;
        for (var x = pos.x; x < wall.x_length; x++) {
            if (wall[x][pos.y] === status.tiled) {
                tiled_size_x++
                if (tiled_size_x >= 8) {
                    break;
                }
            }
        }
        for (var y = pos.y; y < wall.y_length; y++) {
            if (wall[pos.x][y] === status.tiled) {
                tiled_size_y++
                if (tiled_size_y >= 8) {
                    break;
                }
            }
        }
        return {x:tiled_size_x, y:tiled_size_y};
    }
    /**
     * 查找合适的瓷砖
     * @Author   zjf
     * @DateTime 2017-05-20
     * @param    {Object}   notiled_size 待粘贴区域大小
     * @param    {Array}   tiles_info   全部瓷砖信息
     * @return   {int}                瓷砖号，返回-1表示没有合适的
     */         
    function find_suitable_tile(notiled_size, tiles_info){
        for (var i = 0; i < tiles_info.length; i++) {
            if (tiles_info[i].size.x <= notiled_size.x && tiles_info[i].size.y <= notiled_size.y) {
                return i;
            }
        }
        return -1;
    }

    // 获取普通列宽
    function get_col_width(opts){
        return opts.tile_margin*2 + opts.tile_halfsize;
    }

    // 获取小屏下的列宽
    function get_m_col_width(opts){
        return opts.tile_margin*2 + opts.tile_halfsize/opts.tile_mdfactor;
    }

    // 获取列数最大值
    function get_max_row_num(tiles_info){
        var max_row_num = 0;
        for (var i = 0; i < tiles_info.length; i++) {
            max_row_num += tiles_info[i].size.y;
        }
        return max_row_num;
    }

    function create_tile(tile_size, tile_class, tile_content){
        var $tile = $('<div class=""><div class="tile-content iconic"></div></div>');
        $tile.addClass(tile_class);
        $tile.find('.tile-content').html(tile_content);
        console.log($tile);
        switch(tile_size.x){
            case 1:
                $tile.addClass('tile-small-x');
                break;
            case 2:
                $tile.addClass('tile-square-x');
                break;
            case 4:
                $tile.addClass('tile-large-x');
                break;
            case 6:
                $tile.addClass('tile-big-x');
                break;
            case 8:
                $tile.addClass('tile-super-x');
                break;
        }
        switch(tile_size.y){
            case 1:
                $tile.addClass('tile-small-y');
                break;
            case 2:
                $tile.addClass('tile-square-y');
                break;
            case 4:
                $tile.addClass('tile-large-y');
                break;
            case 6:
                $tile.addClass('tile-big-y');
                break;
            case 8:
                $tile.addClass('tile-super-y');
                break;
        }
        return $tile;
    }

})(window.jQuery);