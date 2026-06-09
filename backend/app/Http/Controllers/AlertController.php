<?php

namespace App\Http\Controllers;

use App\Services\AlertService;
use Illuminate\Http\JsonResponse;

class AlertController extends Controller
{
    public function __construct(private AlertService $alerts) {}

    public function index(): JsonResponse
    {
        return response()->json($this->alerts->getUnacknowledged());
    }

    public function acknowledge(int $id): JsonResponse
    {
        $this->alerts->acknowledge($id);
        return response()->json(['message' => 'Alert acknowledged']);
    }

    public function acknowledgeAll(): JsonResponse
    {
        $this->alerts->acknowledgeAll();
        return response()->json(['message' => 'All alerts acknowledged']);
    }
}
