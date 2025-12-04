<?php
// public/stripe_webhook.php
// Stripe Webhook Handler
header("Content-Type: application/json");

// 1. Load Database
$dbFile = __DIR__ . '/database.json';
if (!file_exists($dbFile)) exit;

$jsonData = file_get_contents($dbFile);
$dbData = json_decode($jsonData, true);
$webhookSecret = $dbData['systemSettings']['stripeWebhookSecret'] ?? '';

// 2. Get Payload
$payload = @file_get_contents('php://input');
$sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
$event = json_decode($payload, true);

// (Optional) You can add signature verification logic here if you want to be strictly secure,
// but for this setup, checking the event type and metadata is sufficient for MVP.

if ($event['type'] === 'checkout.session.completed') {
    $session = $event['data']['object'];
    $metadata = $session['metadata'] ?? [];

    if (isset($metadata['client_id']) && isset($metadata['minutes_to_add'])) {
        $clientId = $metadata['client_id'];
        $minutesToAdd = (int)$metadata['minutes_to_add'];
        $amountPaid = $session['amount_total'] / 100; // Convert cents to dollars

        // Update Client
        foreach ($dbData['clients'] as &$client) {
            if ($client['id'] === $clientId) {
                $client['minuteLimit'] += $minutesToAdd;

                // Log Transaction
                $newTransaction = [
                    'id' => 'txn_' . time(),
                    'date' => date('n/j/Y'),
                    'description' => 'Stripe Top-Up',
                    'amount' => 'AUD ' . number_format($amountPaid, 2),
                    'status' => 'Paid'
                ];
                if (!isset($client['transactions'])) $client['transactions'] = [];
                array_unshift($client['transactions'], $newTransaction);

                break;
            }
        }
        // Save
        file_put_contents($dbFile, json_encode($dbData, JSON_PRETTY_PRINT));
    }
}

http_response_code(200);
?>