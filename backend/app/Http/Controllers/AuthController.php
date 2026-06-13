<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function authPayload(User $user, string $token): array
    {
        return [
            'user' => $user->apiData(),
            'token' => $token,
            'settings' => $user->settings?->only(['temp_unit', 'theme', 'notification_urls']) ?? ['temp_unit' => 'C', 'theme' => 'dark', 'notification_urls' => null],
            'locations' => $user->locations()->orderBy('is_default', 'desc')->get(),
        ];
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $isFirst = User::count() === 0;
        $user = User::create(array_merge($validated, ['is_admin' => $isFirst]));
        UserSetting::create(['user_id' => $user->id, 'temp_unit' => 'C', 'theme' => 'dark']);

        // Fires SendEmailVerificationNotification listener automatically
        event(new Registered($user));

        $token = $user->createToken('app')->plainTextToken;

        return response()->json($this->authPayload($user, $token), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->tokens()->delete();
        $token = $user->createToken('app')->plainTextToken;

        return response()->json($this->authPayload($user, $token));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json([
            'user' => $user->apiData(),
            'settings' => $user->settings?->only(['temp_unit', 'theme', 'notification_urls']) ?? ['temp_unit' => 'C', 'theme' => 'dark', 'notification_urls' => null],
            'locations' => $user->locations()->orderBy('is_default', 'desc')->get(),
        ]);
    }

    /** Complete email verification from the signed link. */
    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        if (!hash_equals(sha1($user->email), $hash)) {
            return response()->json(['message' => 'Invalid verification link.'], 403);
        }

        if (!$request->hasValidSignature()) {
            return response()->json(['message' => 'Verification link has expired.'], 403);
        }

        if (!$user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return response()->json(['message' => 'Email verified successfully.']);
    }

    /** Resend verification email to the authenticated user. */
    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email is already verified.'], 422);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification email sent.']);
    }
}
