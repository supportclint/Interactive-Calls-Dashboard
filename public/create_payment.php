<?php
// public/create_payment.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json");

// 1. Load Configuration
$dbFile = __DIR__ . '/database.json';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
}

$jsonData = file_get_contents($dbFile);
$dbData = json_decode($jsonData, true);
$stripeKey = $dbData['systemSettings']['stripeSecretKey'] ?? '';

if (empty($stripeKey)) {
    http_response_code(500);
    echo json_encode(['error' => 'Stripe Secret Key not configured in Admin Panel']);
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
// Ensure amount is a float (e.g. "0.35" -> 0.35)
$amountAUD = isset($data['amount']) ? (float)$data['amount'] : 0.00;
$minutes = isset($data['minutes']) ? (int)$data['minutes'] : 0;
$planName = $data['plan_name'] ?? 'Top Up';

// Stripe Minimum Amount Check (approx $0.50 AUD is required)
if ($amountAUD < 0.50) {
    http_response_code(400);
    echo json_encode(['error' => 'Minimum payment amount is $0.50 AUD. Please increase minutes.']);
    exit;
}

// 3. Create Stripe Session via cURL (No SDK needed)
$url = 'https://api.stripe.com/v1/checkout/sessions';
$headers = [
    'Authorization: Bearer ' . $stripeKey,
    'Content-Type: application/x-www-form-urlencoded'
];

// Convert to cents (must be integer)
$amountCents = (int)round($amountAUD * 100);

$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];
// Adjust path if in subdirectory
$path = dirname($_SERVER['REQUEST_URI']);
// Clean path to ensure it points to root or specific app folder correctly
if ($path == '/' || $path == '\\') $path = '';
$redirectBase = "$protocol://$host$path";

// Redirect back to dashboard (Assuming dashboard is at index.html)
$successUrl = "$protocol://$host/"; 
$cancelUrl = "$protocol://$host/";

$postData = http_build_query([
    'payment_method_types' => ['card'],
    'line_items' => [[
        'price_data' => [
            'currency' => 'aud',
            'product_data' => [
                'name' => "Top Up: $planName",
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
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Connection to Stripe failed', 'details' => $curlError]);
    exit;
}

$json = json_decode($response, true);

if ($httpCode === 200 && isset($json['url'])) {
    echo json_encode(['url' => $json['url']]);
} else {
    http_response_code(500);
    // Return the Stripe error message if available
    $msg = $json['error']['message'] ?? 'Unknown Stripe Error';
    echo json_encode(['error' => $msg, 'details' => $json]);
}
?>