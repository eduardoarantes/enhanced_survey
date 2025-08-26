const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testThrottling() {
  console.log('Testing throttling mechanism...\n');

  // First, get a session ID
  const sessionResponse = await fetch(`${API_BASE_URL}/api/session`, {
    method: 'POST',
  });
  const sessionData = await sessionResponse.json();
  const sessionId = sessionData.sessionId;
  
  console.log(`Session ID: ${sessionId}\n`);

  // Test multiple rapid requests
  const testRequests = 12; // More than the limit of 10
  
  console.log(`Making ${testRequests} rapid requests...\n`);
  
  for (let i = 1; i <= testRequests; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({
          question: 'Test question?',
          answer: `Test answer ${i}`,
          prompt: 'Test prompt',
          apiKey: 'sk-test123456789', // Invalid key for testing
        }),
      });

      if (response.ok) {
        console.log(`Request ${i}: SUCCESS`);
      } else {
        const error = await response.json();
        if (response.status === 429) {
          console.log(`Request ${i}: THROTTLED - ${error.message}`);
        } else {
          console.log(`Request ${i}: ERROR (${response.status}) - ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`Request ${i}: NETWORK ERROR - ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Check session status
  console.log('\n--- Session Status ---');
  const statusResponse = await fetch(`${API_BASE_URL}/api/session/${sessionId}/status`);
  const statusData = await statusResponse.json();
  console.log(`Requests in window: ${statusData.requestsInWindow}/${statusData.maxRequests}`);
  
  console.log('\n--- Waiting 61 seconds for reset... ---');
  console.log('(In a real scenario, you would wait for the throttling window to reset)');
  
  // Test one more request after showing the principle
  setTimeout(async () => {
    console.log('\n--- Testing after delay ---');
    const finalStatusResponse = await fetch(`${API_BASE_URL}/api/session/${sessionId}/status`);
    const finalStatusData = await finalStatusResponse.json();
    console.log(`Requests in window: ${finalStatusData.requestsInWindow}/${finalStatusData.maxRequests}`);
    console.log('Throttling test completed!');
  }, 2000); // Just 2 seconds for demo
}

// Run the test
testThrottling().catch(console.error);