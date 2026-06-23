<?php

namespace App\Models;

use App\Notifications\VerifyEmailNotification;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'is_admin', 'role', 'email_verified_at'];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'password'          => 'hashed',
        'email_verified_at' => 'datetime',
        'is_admin'          => 'boolean',
    ];

    public function locations(): HasMany
    {
        return $this->hasMany(UserLocation::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }

    public function notificationTargets(): HasMany
    {
        return $this->hasMany(NotificationTarget::class);
    }

    /**
     * Maximum number of notification targets this user may create, based on
     * their role. 0 means unlimited. Falls back to a default of 5.
     */
    public function maxNotificationTargets(): int
    {
        $key = 'notify_max_targets_' . ($this->role ?? 'user');
        return \App\Models\AppSetting::getInt($key, 5);
    }

    /** Return a consistent user payload for API responses. */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification());
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function apiData(): array
    {
        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'email'             => $this->email,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'is_admin'          => (bool) $this->is_admin,
            'role'              => $this->role ?? 'user',
        ];
    }
}
