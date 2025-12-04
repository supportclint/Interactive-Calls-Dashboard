<?php
// Endpoint for External Tools (GHL, Make.com) to fetch Client Status
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: x-api-key");
header("Content-Type: application/json");

// 1. Load Database
$dbFile = __DIR__ . '/database.json';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
}

$dbData = json_decode(file_get_contents($dbFile), true);
$systemSettings = $dbData['systemSettings'] ?? [];
$masterKey = $systemSettings['masterApiKey'] ?? '';

// 2. Authenticate Request
$headers = getallheaders();
$providedKey = $headers['x-api-key'] ?? $_GET['api_key'] ?? '';

if (empty($masterKey) || $providedKey !== $masterKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Invalid or missing API Key.']);
    exit;
}

// 3. Identify Client
$email = $_GET['email'] ?? '';
$loginId = $_GET['login_id'] ?? '';

if (empty($email) && empty($loginId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing parameters. Provide "email" or "login_id".']);
    exit;
}

$foundClient = null;
foreach ($dbData['clients'] as $client) {
    if ((!empty($email) && strtolower($client['email']) === strtolower($email)) || 
        (!empty($loginId) && strtolower($client['memberLoginId']) === strtolower($loginId))) {
        $foundClient = $client;
        break;
    }
}

if (!$foundClient) {
    http_response_code(404);
    echo json_encode(['error' => 'Client not found']);
    exit;
}

// 4. Return Data
$usagePercentage = ($foundClient['minuteLimit'] > 0) 
    ? ($foundClient['usedMinutes'] / $foundClient['minuteLimit']) * 100 
    : 0;

echo json_encode([
    'client_id' => $foundClient['id'],
    'name' => $foundClient['name'],
    'minute_limit' => $foundClient['minuteLimit'],
    'used_minutes' => $foundClient['usedMinutes'],
    'usage_percentage' => round($usagePercentage, 2),
    'overages_enabled' => $foundClient['overagesEnabled'] ?? false,
    'is_at_capacity' => $usagePercentage >= 100,
    'is_near_capacity' => $usagePercentage >= 80
]);
?>