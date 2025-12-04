<?php
// Proxy for Vapi.ai API to handle CORS and Authorization on SiteGround
// DISABLE CACHING
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Authorization, Content-Type");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Function to find the Authorization Header (SiteGround Proof)
function getAuthHeader() {
    $headers = null;
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    }

    if (isset($headers['Authorization'])) {
        return $headers['Authorization'];
    }
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    return null;
}

$authHeader = getAuthHeader();

if (!$authHeader) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Missing Authorization Header',
        'debug' => 'Server stripped the API Key. Check .htaccess or PHP config.'
    ]);
    exit;
}

// Build the Vapi URL
// We manually reconstruct the query string to REMOVE the '_cb' (cache buster) parameter
// so Vapi doesn't get confused.
$params = $_GET;
unset($params['_cb']); // Remove our internal cache buster
$queryString = http_build_query($params);

$baseUrl = 'https://api.vapi.ai/call';
$url = $baseUrl . '?' . $queryString;

// Initialize cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ' . $authHeader,
    'Content-Type: application/json'
]);

// Execute
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => 'Proxy cURL Error: ' . curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
?>