<?php
// public/create_payment.php
// Prevent HTML errors from breaking JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// Logging Helper
function logError($msg) {
    $logFile = __DIR__ . '/payment_errors.log';
    $entry = date('Y-m-d H:i:s') . " - " . $msg . "\n";
    file_put_contents($logFile, $entry, FILE_APPEND);
}

// 1. Load Configuration
$dbFile = __DIR__ . '/database.json';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
}

$jsonData = file_get_contents($dbFile);
$dbData = json_decode($jsonData, true);
$settings = $dbData['systemSettings'] ?? [];

// Determine Mode
$isTestMode = !empty($settings['isStripeTestMode']);
$stripeKey = $isTestMode ? ($settings['stripeTestSecretKey'] ?? '') : ($settings['stripeSecretKey'] ?? '');

if (empty($stripeKey)) {
    http_response_code(500);
    echo json_encode(['error' => ($isTestMode ? 'Test' : 'Live') . ' Stripe Key not configured']);
    exit;
}

// 2. Read Input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON input']);
    exit;
}

$clientId = $data['client_id'] ?? '';
// Force float
$amountAUD = isset($data['amount']) ? (float)$data['amount'] : 0.00;
$minutes = isset($data['minutes']) ? (int)$data['minutes'] : 0;
$planName = $data['plan_name'] ?? 'Top Up';

if ($amountAUD < 0.50) {
    http_response_code(400);
    echo json_encode(['error' => 'Minimum payment amount is $0.50 AUD.']);
    exit;
}

// 3. Create Stripe Session
$url = 'https://api.stripe.com/v1/checkout/sessions';
$headers = [
    'Authorization: Bearer ' . $stripeKey,
    'Content-Type: application/x-www-form-urlencoded'
];

$amountCents = (int)round($amountAUD * 100);

$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];
$path = dirname($_SERVER['REQUEST_URI']);
if ($path == '/' || $path == '\\') $path = '';
$redirectBase = rtrim("$protocol://$host$path", '/');

$successUrl = $redirectBase . "/?session_id={CHECKOUT_SESSION_ID}"; 
$cancelUrl = $redirectBase . "/";

$postData = http_build_query([
    'payment_method_types' => ['card'],
    'line_items' => [[
        'price_data' => [
            'currency' => 'aud',
            'product_data' => [
                'name' => ($isTestMode ? "[TEST] " : "") . "Top Up: $planName",
                'description' => "Add $minutes minutes to your call balance."
            ],
            'unit_amount' => $amountCents,
        ],
        'quantity' => 1,
    ]],
    'mode' => 'payment',
    'success_url' => $successUrl,
    'cancel_url' => $cancelUrl,
    'metadata' => [
        'client_id' => $clientId,
        'minutes_to_add' => $minutes,
        'transaction_type' => 'top_up'
    ]
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$json = json_decode($response, true);

if ($httpCode === 200 && isset($json['url'])) {
    echo json_encode(['url' => $json['url']]);
} else {
    logError("Stripe API Error: " . $response);
    http_response_code(500);
    $msg = $json['error']['message'] ?? 'Unknown Stripe Error';
    echo json_encode(['error' => $msg, 'details' => $json]);
}
?>