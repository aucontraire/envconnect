/* Copyright (c) 2018, DjaoDjin inc.
   see LICENSE. */

/* global $ c3: true */

(function ($) {
    "use strict";

    /**
       Augment a user interface element with a benchmark chart

       The element should look like:

       <div>
         <ul class="nav nav-tabs dashboard-tab" role="tablist">
         </ul>
         <div>
           <div>
             <input id="variable-name" type="text" name="..." value="..." />
             <button class="style-reset-button"
                  type="button" title="reset to default"
                  data-target="#variable-name" data-reset-value="...">
             </button>
           </div>
           ...
         </div>
       </div>
    */
    function BenchmarkChart(el, options){
        this.element = el;
        this.options = options;
        this.init();
    }

    BenchmarkChart.prototype = {
        init: function () {
            var self = this;
            var element = $(self.element);
            if( self.options.nb_questions === 0 ) {
                element.append("<div class=\"benchmark-chart\"><em>No assessment questions</em></div>");
                return false;
            }
            if( self.options.nb_answers !== self.options.nb_questions ) {
                element.append("<div class=\"benchmark-chart\"><em>You answered "
                    + self.options.nb_answers + " out of "
                    + self.options.nb_questions + " questions on the assessment.</em></div>");
                return false;
            }

            function isEmpty(scores) {
                for (var prop in scores) {
                    if (scores.hasOwnProperty(prop)) return false;
                }
                return true;
            }

            if(!self.options.scores || isEmpty(self.options.scores) ) {
                element.append("<div class=\"benchmark-chart\"><em>Not enough data.</em></div>");
                return false;
            }

            var dist = [self.options.title].concat(self.options.scores.y);
            var yourRateClass = (parseInt(
                self.options.scores.organization_rate) < 50) ?
                "below-average" : "above-average";
            var xValues = ["x"].concat(self.options.scores.x);
            var chart = c3.generate({
                transition: {
                    duration: this.options.duration,
                },
                size: {
                    width: element.width(),
                    height: element.height() // 120
                },
                color: {
                    pattern: ["#D9EAC6"]
                },
                bindto: self.element,
                data: {
                    x: "x",
                    columns: [
                        xValues,
                        dist
                    ],
                    type: "bar",
                    labels: true,
                    color: function (color, d) {
                        if( d.x == 0 ) {
                            return "#9CD76B";    // green-level-0
                        } else if( d.x == 1 ) {
                            return "#69B02B"; // green-level-1
                        }  else if( d.x == 2 ) {
                            return "#007C3F"; // green-level-2
                        }
                        return "#FFD700"; // green-level-3
                    }
                },
                grid: {
                    x: {
                        lines: [{
                            value: self.options.scores.organization_rate,
                            text: "You", class: yourRateClass,
                            "stroke-dasharray": "5,5",
                            position: "start"
                        }]
                    }
                },
                legend: {
                    show: false
                },
                tooltip: {
                    show: false
                },
                axis: {
                    x: {
                        type: "category"
                    },
                    y: {
                        label: {
                            text: "# of companies",
                            position: "outer-middle"
                        },
                        tick: { count: 1}
                    }
                }
            });
        },
    };

    $.fn.benchmarkChart = function(options) {
        var opts = $.extend( {}, $.fn.benchmarkChart.defaults, options );
        return this.each(function() {
            if (!$.data(this, "benchmarkChart")) {
                $.data(this, "benchmarkChart", new BenchmarkChart(this, opts));
            }
        });
    };

    $.fn.benchmarkChart.defaults = {
        title: null,
        nb_answers: 0,
        nb_questions: 0,
        scores: null,
        duration: 350
    };


    /**
       Augment a user interface element with an historical scores chart

       The element should look like:

       <div style="width:300px;margin:auto;"></div>
    */
    function HistoricalScoreChart(el, options){
        this.element = el;
        this.options = options;
        this.init();
    }

    HistoricalScoreChart.prototype = {
        init: function () {
            var self = this;
            if( Array.isArray(self.options.scores) ) {
                self.updateChart(self.options.scores);
            } else {
                self._load();
            }
        },

        _load: function() {
            var self = this;
            $.ajax({
                method: "GET",
                url: self.options.scores, // interpreted as API endpoint
                contentType: "application/json; charset=utf-8",
                success: function(data) {
                    self.updateChart(data);
                    $(self.element).trigger("chart.loaded");
                },
                error: function(resp) {
                    if( resp.status === 404 ) {
                        var svgContainer = self.$element.find(".chart")[0];
                        $(svgContainer).empty();
                        $(svgContainer).append('<div>Not found</div>');
                    } else {
                        showErrorMessages(resp);
                    }
                }
            });
        },

        updateChart: function(data) {
            var self = this;
            nv.addGraph(function() {
                // Read the enumeration of ticks to use on the x-axis.
                var enumTicks = [];
                var enumIndexes = [];
                if( data.length > 0 ) {
                    for( var idx = 0; idx < data[0].values.length; ++idx ) {
                        enumTicks.push(data[0].values[idx][0]);
                        enumIndexes.push(idx + 1);
                    }
                }

                // clear any previous chart elements before adding new ones.
                // remove svg and append it again to remove all previous
                // attached events.
                var container = d3.select(self.element);
                container.select("svg").remove();
                container.append("svg").attr("class", "chart-area");

                // find bounds of the dataset.
                var maxY = 0;
                var values = data[0].values;
                var j = 0;
                var i = 0;
                for( j = 0; j < data.length; ++j ) {
                    values = data[j].values;
                    for( i = 0; i < values.length; ++i ) {
                        if( values[i][1] > maxY ) { maxY = values[i][1]; }
                    }
                }

                var chart = nv.models.lineChart()
                    .x(function(d) {
                        for( var idx = 0; idx < enumTicks.length; ++idx ) {
                            if( d[0] === enumTicks[idx] ) {
                                return idx + 1;
                            }
                        }
                        return 0;
                    })
                    .y(function(d) { return d[1]; })
                    .margin({top: 50, right: 20, bottom: 140, left: 150})
                    .useInteractiveGuideline(true);

                chart.xAxis
                    .rotateLabels(-45)
                    .showMaxMin(false)  //remove max and min in x axe
                    .tickValues(enumIndexes)
                    .tickFormat(function(d) {
                        if( d <= enumTicks.length ) {
                            return enumTicks[d - 1];
                        }
                        return d;
                    });

                chart.yAxis
                    .tickFormat(function(d) {
                        return d3.format(".0f")(d) + "%";})
                    .axisLabel("Scores");
                chart.forceY([0, 100]);

                container.select("svg")
                    .datum(data)
                    .transition().duration(100)
                    .call(chart);

                nv.utils.windowResize(chart.update);

                return chart;
            });
        },
    };

    $.fn.historicalScoreChart = function(options) {
        var opts = $.extend( {}, $.fn.historicalScoreChart.defaults, options );
        return this.each(function() {
            if (!$.data(this, "historicalScoreChart")) {
                $.data(this, "historicalScoreChart",
                    new HistoricalScoreChart(this, opts));
            }
        });
    };

    $.fn.historicalScoreChart.defaults = {
        scores: null,
        duration: 350
    };

})(jQuery);


/** Chart for the total score.
 */
function radialProgress(parent, dur) {
    var element = $(parent);
    var _data=null,
        _duration= 1000,
        _selection,
        _margin = {top:0, right:0, bottom:30, left:0},
        __width = 300 - 28,   // @score-card-width
        __height = element.height() || 200,
        _diameter = element.width() || 300,
        _fontSize = 10;

    if( typeof dur !== "undefined" ) {
        _duration = dur;
    }

    var _value1 = 0, _value2 = 0, _value3 = 0;

    var _minValue = 0, _maxValue = 100;

    var  _currentArc1 = - Math.PI / 2,
         _currentArc2 = - Math.PI / 2,
         _currentArc3 = - Math.PI / 2;
    var  _currentValue1=0, _currentValue2=0, _currentValue3 = 0;

    var _arc1 = d3.svg.arc()
        .startAngle(_currentArc1);

    var _arc2 = d3.svg.arc()
        .startAngle(_currentArc2);

    var _arc3 = d3.svg.arc()
        .startAngle(_currentArc3);

    _selection=d3.select(parent);

    function component() {

        _selection.each(function (data) {

            // Select the svg element, if it exists.
            var svg = d3.select(this).selectAll("svg").data([data]);

            var enter = svg.enter().append("svg").attr("class","radial-svg").append("g");

            measure();

            svg.attr("width", __width)
                .attr("height", __height);

            var background = enter.append("g").attr("class", "component");

            background.append("rect")
                .attr("class","background")
                .attr("width", _width)
                .attr("height", _height);

            background.append("path")
                .attr("transform", "translate(" + _width/2 + "," + _width/2 + ")")
                .attr("d", _arc1);

           var g = svg.select("g")
                .attr("transform", "translate(" + _margin.left + "," + _margin.top + ")");
            enter.append("g").attr("class", "arcs");
            var arcs = svg.select(".arcs");

            /* top score */
            var path1 = arcs.selectAll("#arc1").data(data);
            path1.enter().append("path")
                .attr("id","arc1")
                .attr("class", fillClass("#arc1", _value1))
                .attr("transform", "translate(" + _width/2 + "," + _width/2 + ")")
                .attr("d", _arc1);

            arcs.append("text")
                .attr("x", 6)
                .attr("dy", 15).append("textPath")
                .attr("class", textClass("#arc1", _value1))
                .attr("xlink:href","#arc1")
                .text("top score (" + _value1 + "%)");

            var path2 = arcs.selectAll("#arc2").data(data);
            path2.enter().append("path")
                .attr("id","arc2")
                .attr("class", fillClass("#arc2", _value2))
                .attr("transform", "translate(" + _width/2 + "," + _width/2 + ")")
                .attr("d", _arc2);

            arcs.append("text")
                .attr("x", 6)
                .attr("dy", 15).append("textPath")
                .attr("class", textClass("#arc2", _value2))
                .attr("xlink:href","#arc2")
                .text("average (" + _value2 + "%)");

            var path3 = arcs.selectAll("#arc3").data(data);
            path3.enter().append("path")
                .attr("id","arc3")
                .attr("class", fillClass("#arc3", _value3))
                .attr("transform", "translate(" + _width/2 + "," + _width/2 + ")")
                .attr("d", _arc3);

            arcs.append("text")
                .attr("x", 6)
                .attr("dy", 15).append("textPath")
                .attr("class", textClass("#arc3", _value3))
                .attr("xlink:href","#arc3")
                .text("you (" + _value3 + "%)");

            enter.append("g").attr("class", "labels");
            var label = svg.select(".labels").selectAll(".label").data(data);
            label.enter().append("text")
                .attr("class","label")
                .attr("y",_width/2+_fontSize/3)
                .attr("x",_width/2)
                .attr("cursor","pointer")
                .attr("width",_width)
                // .attr("x",(3*_fontSize/2))
                .text(function (d) {
                    return Math.round(
                        (_value3 - _minValue) / (_maxValue - _minValue) * 100)
                        + "%"; })
                .style("font-size",_fontSize+"px");

            path1.exit().transition().duration(_duration / 2).attr("x", _duration).remove();

            layout(svg);

            function layout(svg) {
                path1.datum((- Math.PI / 2) + Math.PI * Math.min(
                    (_value1 - _minValue) / (_maxValue - _minValue), 1));
                path1.transition().duration(_duration)
                    .attrTween("d", arcTween);

                path2.datum((- Math.PI / 2) + Math.PI * Math.min(
                    (_value2 - _minValue) / (_maxValue - _minValue), 1));
                path2.transition().duration(_duration)
                        .attrTween("d", arcTween2);

                var ratio = (_value3 - _minValue) / (_maxValue - _minValue);
                path3.datum((- Math.PI / 2) + Math.PI * Math.min(ratio, 1));
                path3.transition().duration(_duration)
                        .attrTween("d", arcTween3);

                label.datum(Math.round(ratio*100));
                label.transition().duration(_duration)
                    .tween("text",labelTween);

            }

        });
    }

    function textClass(id, value) {
        return "label";
    }

    function fillClass(id, value) {
        if( id === "#arc1" ) {
            return "arc3"; // green-level-3
        } if( id === "#arc2" ) {
            return "arc2"; // green-level-2
        }
        return "arc1"; // green-level-1
    }

    function labelTween(a) {
        var i = d3.interpolate(_currentValue3, a);
        _currentValue3 = i(0);

        return function(t) {
            _currentValue3 = i(t);
            this.textContent = Math.round(i(t)) + "%";
        }
    }

    function arcTween(a) {
        var i = d3.interpolate(_currentArc1, a);

        return function(t) {
            _currentArc1=i(t);
            return _arc1.endAngle(i(t))();
        };
    }

    function arcTween2(a) {
        var i = d3.interpolate(_currentArc2, a);

        return function(t) {
            return _arc2.endAngle(i(t))();
        };
    }

    function arcTween3(a) {
        var i = d3.interpolate(_currentArc3, a);

        return function(t) {
            return _arc3.endAngle(i(t))();
        };
    }

    function measure() {
        _width=_diameter - _margin.right - _margin.left - _margin.top - _margin.bottom;
        _height=_width;
        _fontSize=_width*.2;
        _arc1.outerRadius(_width/2);
        _arc1.innerRadius(_width/2 * .85);
        _arc2.outerRadius(_width/2 * .85);
        _arc2.innerRadius(_width/2 * .85 - (_width/2 * .15));
        _arc3.outerRadius(_width/2 * .70);
        _arc3.innerRadius(_width/2 * .70 - (_width/2 * .15));
    }


    component.render = function() {
        measure();
        component();
        return component;
    }

    component.value1 = function (_) {
        if (!arguments.length) return _value1;
        _value1 = [_];
        _selection.datum([_value1]);
        return component;
    }

    component.value2 = function (_) {
        if (!arguments.length) return _value2;
        _value2 = [_];
        _selection.datum([_value2]);
        return component;
    }

    component.value3 = function (_) {
        if (!arguments.length) return _value3;
        _value3 = [_];
        _selection.datum([_value3]);
        return component;
    }

    component.margin = function(_) {
        if (!arguments.length) return _margin;
        _margin = _;
        return component;
    };

    component.diameter = function(_) {
        if (!arguments.length) return _diameter
        _diameter =  _;
        return component;
    };

    component.minValue = function(_) {
        if (!arguments.length) return _minValue;
        _minValue = _;
        return component;
    };

    component.maxValue = function(_) {
        if (!arguments.length) return _maxValue;
        _maxValue = _;
        return component;
    };

    component._duration = function(_) {
        if (!arguments.length) return _duration;
        _duration = _;
        return component;
    };

    return component;
}


function speedometer(parent) {

    var config = {
        size: 200,
        clipWidth: 200,
        clipHeight: 110,
        ringInset: 20,
        ringWidth: 20,

        pointerWidth: 10,
        pointerTailLength: 5,
        pointerHeadLengthPercent: 0.9,

        minValue: 0,
        maxValue: 10,

        minAngle: -90,
        maxAngle: 90,

        transitionMs: 750,

        majorTicks: 5,
        labelFormat: d3.format(',g'),
        labelInset: 10,

        arcColorFn: d3.interpolateHsl(d3.rgb('#e8e2ca'), d3.rgb('#3e6c0a'))
    };

    var r = config.size / 2;
    var pointer = null;
    var _selection = d3.select(parent);

    // a linear scale that maps domain values to a percent from 0..1
    var scale = d3.scale.linear()
        .range([0, 1])
        .domain([config.minValue, config.maxValue]);

    var ticks = null;

    function deg2rad(deg) {
        return deg * Math.PI / 180;
    }

    function component() {
        _selection.each(function (data) {
            var svg = d3.select(this).selectAll("svg").data([data]);
            var enter = svg.enter()
                .append("svg")
                .attr('class', 'gauge')
                .attr('width', config.clipWidth)
                .attr('height', config.clipHeight);

            var centerTx = 'translate(' + r + ',' + r +')';

            var arcs = svg.append('g')
                .attr('class', 'arc')
                .attr('transform', centerTx);

            var tickData = d3.range(config.majorTicks).map(function() {
                return 1 / config.majorTicks;
            });

            var range = config.maxAngle - config.minAngle;
            var arc = d3.svg.arc()
                .innerRadius(r - config.ringWidth - config.ringInset)
                .outerRadius(r - config.ringInset)
                .startAngle(function(d, i) {
                    var ratio = d * i;
                    return deg2rad(config.minAngle + (ratio * range));
                })
                .endAngle(function(d, i) {
                    var ratio = d * (i+1);
                    return deg2rad(config.minAngle + (ratio * range));
                });

            arcs.selectAll('path')
                .data(tickData)
                .enter().append('path')
                .attr('fill', function(d, i) {
                    return config.arcColorFn(d * i);
                })
                .attr('d', arc);

            ticks = svg.append('g')
                .attr('class', 'label')
                .attr('transform', centerTx);
            configure(config);

            var pointerHeadLength = Math.round(
                r * config.pointerHeadLengthPercent);
            var lineData = [ [config.pointerWidth / 2, 0],
                             [0, -pointerHeadLength],
                             [-(config.pointerWidth / 2), 0],
                             [0, config.pointerTailLength],
                             [config.pointerWidth / 2, 0] ];
            var pointerLine = d3.svg.line().interpolate('monotone');
            var pg = svg.append('g').data([lineData])
                .attr('class', 'pointer')
                .attr('transform', centerTx);
            pointer = pg.append('path')
                .attr('d', pointerLine)
                .attr('transform', 'rotate(' + config.minAngle + ')');
        });
    }

    function measure() {
    }

    function configure(settings) {
        $.extend(config, settings);
        scale.domain([config.minValue, config.maxValue]);
        if( ticks ) {
        var range = config.maxAngle - config.minAngle;
        var tickNodes = ticks.selectAll('text')
                .data(scale.ticks(config.majorTicks))
                    .attr('transform', function(d) {
                        var ratio = scale(d);
                        var newAngle = config.minAngle + (ratio * range);
                        return 'rotate(' + newAngle + ') translate(0,'
                            + (config.labelInset - r) + ')'; })
                    .text(function(d) { return config.labelFormat(d) + "%"; });
            tickNodes.enter()
                    .append('text')
                    .attr('transform', function(d) {
                        var ratio = scale(d);
                        var newAngle = config.minAngle + (ratio * range);
                        return 'rotate(' + newAngle + ') translate(0,'
                            + (config.labelInset - r) + ')'; })
                    .text(function(d) { return config.labelFormat(d) + "%"; });
            tickNodes.exit()
                    .remove();
        }
    }

    component.render = function() {
        measure();
        component();
        return component;
    }

    component.update = function(newValue, settings) {
        if( settings !== undefined ) {
            configure(settings);
        }
        var ratio = scale(newValue);
        var range = config.maxAngle - config.minAngle;
        var newAngle = config.minAngle + (ratio * range);
        pointer.transition()
            .duration(config.transitionMs)
            .ease('elastic')
            .attr('transform', 'rotate(' + newAngle + ')');
        return component;
    }

    return component;
}

/** Displays a pie chart (completion summary)
 */
function summaryChart(container, data) {
    nv.addGraph(function() {
        var chart = nv.models.pieChart()
            .x(function(d) { return d[0] + ' ('+ d[1] + ')' })
            .y(function(d) { return d[1] })
            .showLabels(true)
            .labelThreshold(.05)
            .labelType("percent")
            .legendPosition("right")
            .donut(true)
            .donutRatio(0.35)
            .color(['red', '#ff5555', '#9CD76B', '#69B02B', '#007C3F', '#FFD700']);
//            .color(d3.scale.category10().range());

        d3.select(container)
            .datum(data)
            .transition().duration(1200)
            .call(chart);

        return chart;
    });
}

