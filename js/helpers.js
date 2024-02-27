/*global $*/
'use strict';


function checkChromeRuntimeError() {
    if (chrome.runtime.lastError) {
        console.error(
            `Chrome API Error: ${chrome.runtime.lastError.message}.\n Traced ${
                new Error().stack
            }`
        );
        return true;
    }
    return false;
}

function constrain(input, min, max) {

    if (input < min) {
        return min;
    }

    if (input > max) {
        return max;
    }

    return input;
}

function zeroPad(value, width) {
    value = "" + value;

    while (value.length < width) {
        value = "0" + value;
    }

    return value;
}

function generateFilename(prefix, suffix) {
    var date = new Date();
    var filename = prefix;

    if (CONFIG) {
        if (CONFIG.flightControllerIdentifier) {
            filename = CONFIG.flightControllerIdentifier + '_' + CONFIG.flightControllerVersion + "_" + filename;
        }
         
        if (CONFIG.name && CONFIG.name.trim() !== '') {
            filename = filename + '_' + CONFIG.name.trim().replace(' ', '_');
        }
    }

    filename = filename + '_' + date.getFullYear()
        + zeroPad(date.getMonth() + 1, 2)
        + zeroPad(date.getDate(), 2)
        + '_' + zeroPad(date.getHours(), 2)
        + zeroPad(date.getMinutes(), 2)
        + zeroPad(date.getSeconds(), 2);

    return filename + '.' + suffix;
}

function scaleRangeInt(x, srcMin, srcMax, destMin, destMax) {
    let a = (destMax - destMin) * (x - srcMin);
    let b = srcMax - srcMin;
    return Math.round((a / b) + destMin);
}

function distanceOnLine(start, end, distance)
{
    var vx = end[0] - start[0];
    var vy = end[1] - start[1];
    var mag = Math.sqrt(vx * vx + vy * vy);
    vx /= mag;
    vy /= mag;

    var px = start[0] + vx * (mag + distance);
    var py = start[1] + vy * (mag + distance);

    return [px, py]; 
}

function wrap_360(angle)
{
    if (angle >= 360)
        angle -= 360;
    if (angle < 0)
        angle += 360;
    return angle;
}

function rad2Deg(rad) 
{
	return rad * (180 / Math.PI);
}

function deg2Rad(deg)
{
	return deg * (Math.PI / 180);
}

function calculate_new_cooridatnes(coord, bearing, distance)
{
    var lat = deg2Rad(coord.lat);
    var lon = deg2Rad(coord.lon);
    bearing = deg2Rad(bearing);
    var delta = distance / 637100000; // Earth radius in cm 
    
    var latNew = Math.asin(Math.sin(lat) * Math.cos(delta) + Math.cos(lat) * Math.sin(delta) * Math.cos(bearing));
    var lonNew = lon + Math.atan2(Math.sin(bearing) * Math.sin(delta) * Math.cos(lat), Math.cos(delta) - Math.sin(lat) * Math.sin(lat));
    return {
        lat: rad2Deg(latNew),
        lon: rad2Deg(lonNew),
    }
}
