<?php

use App\Http\Controllers\AlertController;
use App\Http\Controllers\ThresholdController;
use App\Http\Controllers\WeatherController;
use Illuminate\Support\Facades\Route;

Route::prefix('weather')->group(function () {
    Route::get('/current', [WeatherController::class, 'current']);
    Route::get('/history', [WeatherController::class, 'history']);
    Route::get('/stats', [WeatherController::class, 'stats']);
    Route::post('/fetch', [WeatherController::class, 'fetch']);
});

Route::prefix('alerts')->group(function () {
    Route::get('/', [AlertController::class, 'index']);
    Route::post('/{id}/acknowledge', [AlertController::class, 'acknowledge']);
    Route::post('/acknowledge-all', [AlertController::class, 'acknowledgeAll']);
});

Route::prefix('thresholds')->group(function () {
    Route::get('/', [ThresholdController::class, 'index']);
    Route::put('/{id}', [ThresholdController::class, 'update']);
});

Route::get('/health', fn () => response()->json(['status' => 'ok', 'time' => now()]));
