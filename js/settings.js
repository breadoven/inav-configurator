'use strict';

var Settings = (function () {
    let self = {};

    self.configureInputs = function() {
        var inputs = [];
        $('[data-setting!=""][data-setting]').each(function() {
            inputs.push($(this));
        });
        return Promise.mapSeries(inputs, function (input, ii) {
            var settingName = input.data('setting');
            var inputUnit = input.data('unit');

            return mspHelper.getSetting(settingName).then(function (s) {
                // Check if the input declares a parent
                // to be hidden in case of the setting not being available.
                // Otherwise, default to hiding its parent
                var parent = input.parents('.setting-container:first');
                if (parent.length == 0) {
                    parent = input.parent();
                }
                if (!s) {
                    // Setting doesn't exist.
                    input.val(null);
                    parent.remove();
                    return;
                }
                parent.show();

                if (input.prop('tagName') == 'SELECT' || s.setting.table) {
                    if (input.attr('type') == 'checkbox') {
                        input.prop('checked', s.value > 0);
                    } else {
                        input.empty();
                        for (var ii = s.setting.min; ii <= s.setting.max; ii++) {
                            var name = (s.setting.table ? s.setting.table.values[ii] : null);
                            if (name) {
                                var localizedName = chrome.i18n.getMessage(name);
                                if (localizedName) {
                                    name = localizedName;
                                }
                            } else {
                                // Fallback to the number itself
                                name = ii;
                            }
                            var option = $('<option/>').attr('value', ii).text(name);
                            if (ii == s.value) {
                                option.prop('selected', true);
                            }
                            option.appendTo(input);
                        }
                    }
                } else if (s.setting.type == 'string') {
                    input.val(s.value);
                } else if (s.setting.type == 'float') {
                    input.attr('type', 'number');

                    let dataStep = input.data("step");

                    if (dataStep !== undefined) {
                        input.attr('step', dataStep);
                    } else {
                        input.attr('step', "0.01");
                    }

                    input.attr('min', s.setting.min);
                    input.attr('max', s.setting.max);
                    input.val(s.value.toFixed(2));
                } else {
                    var multiplier = parseFloat(input.data('setting-multiplier') || 1);
                    input.attr('type', 'number');
                    input.val((s.value / multiplier).toFixed(Math.log10(multiplier)));

                    if (s.setting.min) {
                        input.attr('min', (s.setting.min / multiplier).toFixed(Math.log10(multiplier)));
                    }

                    if (s.setting.max) {
                        input.attr('max', (s.setting.max / multiplier).toFixed(Math.log10(multiplier)));
                    }
                }

                // If data is defined, We want to convert this value into 
                // something matching the units        
                self.convertToUnitSetting(input, inputUnit);

                input.data('setting-info', s.setting);
                if (input.data('live')) {
                    input.change(function() {
                        self.saveInput(input);
                    });
                }
            });
        });
    };


    /**
     * 
     * @param {JQuery Element} input 
     * @param {String} inputUnit Unit from HTML Dom input
     */
    self.convertToUnitSetting = function (element, inputUnit) {

        // One of the following;
        // none, OSD, imperial, metric
        const configUnitType = globalSettings.unitType;

        // Small closure to grab the unit as described by either 
        // the app settings or the app OSD settings, confused? yeah
        const getUnitDisplayTypeValue = () => {
            // Try and match the values 
            switch (configUnitType) {
                case UnitType.OSD: // Match the OSD value on the UI
                    return globalSettings.osdUnits;
                    break;
                case UnitType.imperial:
                    return 0; // Imperial OSD Value
                    break;
                case UnitType.metric:
                    return 1; // Metric + MPH OSD Value
                    break;
                case UnitType.none:
                default:
                    // Something went wrong
                    return -1;
            }
        }

        // Sets the int value of the way we want to display the 
        // units. We use the OSD unit values here for easy
        const uiUnitValue = getUnitDisplayTypeValue();

        const oldValue = element.val();

        // Ensure we can do conversions
        if (configUnitType === UnitType.none || uiUnitValue === -1 || !inputUnit || !oldValue || !element) {
            return;
        }

        // Used to convert between a value and a value matching the int
        // unit display value. Eg 1 = Metric 
        // units. We use the OSD unit values here for easy
        const conversionTable = {    
            1: {
                'cm':  { multiplier: 100, unitName: 'm' },
                'cms': { multiplier: 27.77777777777778, unitName: 'Km/h' }
            },
            2: {
                'cm':  { multiplier: 100, unitName: 'm' },
            },          
            4: {
                'cms': { multiplier: 51.44444444444457, unitName: 'Kt' }
            },
            default: {
                'cm':  { multiplier: 30.48, unitName: 'ft' },
                'cms': { multiplier: 44.704, unitName: 'mph' },
                'ms':  { multiplier: 1000, unitName: 'sec' }                
            },
        }

        // Small closure to try and get the multiplier 
        // needed from the conversion table
        const getUnitMultiplier = () => {
            if(conversionTable[uiUnitValue] && conversionTable[uiUnitValue][inputUnit]) {
                return conversionTable[uiUnitValue][inputUnit];
            }
            
            return conversionTable['default'][inputUnit];
        }

        // Get the default multi obj or the custom       
        const multiObj = getUnitMultiplier();

        if(!multiObj) {
            return;
        }

        const multiplier = multiObj.multiplier;
        const unitName = multiObj.unitName;

        // Update the step, min, and max; as we have the multiplier here.
        if (element.attr('type') == 'number') {
            element.attr('step', ((multiplier != 1) ? '0.01' : '1'));
            element.attr('min', (element.attr('min') / multiplier).toFixed(2));
            element.attr('max', (element.attr('max') / multiplier).toFixed(2));
        }

        // Update the input with a new formatted unit
        const convertedValue = Number((oldValue / multiplier).toFixed(2));
        const newValue = Number.isInteger(convertedValue) ? Math.round(convertedValue) : convertedValue;
        element.val(newValue);
        element.data('setting-multiplier', multiplier);

        // Now wrap the input in a display that shows the unit
        element.wrap(`<div data-unit="${unitName}" class="unit_wrapper unit"></div>`);
    }

    self.saveInput = function(input) {
        var settingName = input.data('setting');
        var setting = input.data('setting-info');
        var value;

        if (typeof setting == 'undefined') {
            return null;
        }

        if (setting.table) {
            if (input.attr('type') == 'checkbox') {
                value = input.prop('checked') ? 1 : 0;
            } else {
                value = parseInt(input.val());
            }
        } else if(setting.type == 'string') {
            value = input.val();
        } else {
            var multiplier = parseFloat(input.data('setting-multiplier') || 1);
            value = parseFloat(input.val()) * multiplier;
        }
        return mspHelper.setSetting(settingName, value);
    };

    self.saveInputs = function() {
        var inputs = [];
        $('[data-setting!=""][data-setting]').each(function() {
            inputs.push($(this));
        });
        return Promise.mapSeries(inputs, function (input, ii) {
            return self.saveInput(input);
        });
    };

    self.processHtml = function(callback) {
        return function() {
            self.configureInputs().then(callback);
        };
    };

    self.getInputValue = function(settingName) {
        return $('[data-setting="' + settingName + '"]').val();
    };

    return self;
})();
