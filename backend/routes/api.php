<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\ForecastController;
use App\Http\Controllers\AlertController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ForgotPasswordController;
use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\ResetPasswordController;
use App\Http\Controllers\ThresholdController;
use App\Http\Controllers\UserLocationController;
use App\Http\Controllers\UserPasswordController;
use App\Http\Controllers\UserSettingController;
use App\Http\Controllers\WeatherController;
use Illuminate\Support\Facades\Route;

// Public weather endpoints
Route::prefix('weather')->group(function () {
    Route::get('/current', [WeatherController::class, 'current']);
    Route::get('/history', [WeatherController::class, 'history']);
    Route::get('/stats', [WeatherController::class, 'stats']);
    Route::post('/fetch', [WeatherController::class, 'fetch']);
    Route::get('/live', [WeatherController::class, 'live']);
});

// Public alert endpoints
Route::prefix('alerts')->group(function () {
    Route::get('/', [AlertController::class, 'index']);
    Route::post('/{id}/acknowledge', [AlertController::class, 'acknowledge']);
    Route::post('/acknowledge-all', [AlertController::class, 'acknowledgeAll']);
});

// Public threshold endpoints
Route::prefix('thresholds')->group(function () {
    Route::get('/', [ThresholdController::class, 'index']);
    Route::put('/{id}', [ThresholdController::class, 'update']);
});

// Forecast (hourly + daily)
Route::get('/weather/forecast', [ForecastController::class, 'index']);

// Geocoding
Route::get('/geocoding/search', [GeocodingController::class, 'search']);

// Auth
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    // Email verification — signed URL, no Bearer token required
    Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware('signed')
        ->name('verification.verify');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/email/resend', [AuthController::class, 'resendVerification']);
    });
});

// Authenticated user routes
Route::middleware('auth:sanctum')->prefix('user')->group(function () {
    Route::get('/settings', [UserSettingController::class, 'show']);
    Route::put('/settings', [UserSettingController::class, 'update']);
    Route::post('/password', [UserPasswordController::class, 'changePassword']);

    Route::get('/locations', [UserLocationController::class, 'index']);
    Route::post('/locations', [UserLocationController::class, 'store']);
    Route::patch('/locations/{id}/default', [UserLocationController::class, 'setDefault']);
    Route::delete('/locations/{id}', [UserLocationController::class, 'destroy']);
});

// Password reset (public)
Route::post('/auth/forgot-password', [ForgotPasswordController::class, 'sendResetLink']);
Route::post('/auth/reset-password', [ResetPasswordController::class, 'reset']);

// Admin routes
Route::middleware(['auth:sanctum', 'is_admin'])->prefix('admin')->group(function () {
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{id}', [AdminController::class, 'updateUser']);
    Route::post('/users/{id}/send-reset', [AdminController::class, 'sendResetLink']);
});

Route::get('/health', fn () => response()->json(['status' => 'ok', 'time' => now()]));
