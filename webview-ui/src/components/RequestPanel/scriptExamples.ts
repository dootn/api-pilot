import type { TranslationKey } from '../../i18n';

export interface ScriptExample { labelKey: TranslationKey; code: string; }

export const PRE_SCRIPT_EXAMPLES: ScriptExample[] = [
  {
    labelKey: 'exPreSetEnvVar',
    code: `// Set environment variable
pm.environment.set("variableName", "value");`,
  },
  {
    labelKey: 'exPreCondVar',
    code: `// Set variable based on condition
const timestamp = new Date().toISOString();
pm.environment.set("requestTime", timestamp);

// Use it in your request as {{requestTime}}`,
  },
  {
    labelKey: 'exPreModifyHeaders',
    code: `// Modify request headers
pm.request.headers["Authorization"] = "Bearer " + pm.environment.get("token");
pm.request.headers["X-Custom-Header"] = "CustomValue";
pm.request.headers["X-Timestamp"] = new Date().getTime();`,
  },
  {
    labelKey: 'exPreModifyParams',
    code: `// Modify query parameters
pm.request.url.addQueryParams([
  { key: "timestamp", value: new Date().getTime() },
  { key: "version", value: "1.0" }
]);`,
  },
  {
    labelKey: 'exPreModifyBody',
    code: `// Modify request body
const body = JSON.parse(pm.request.body.raw);
body.timestamp = new Date().getTime();
body.userId = pm.environment.get("userId");
pm.request.body.raw = JSON.stringify(body);`,
  },
  {
    labelKey: 'exPreGenData',
    code: `// Generate random data
const randomId = Math.random().toString(36).substring(2, 15);
const randomEmail = "user_" + randomId + "@example.com";

pm.environment.set("randomId", randomId);
pm.environment.set("randomEmail", randomEmail);

// Log for debugging
console.log("Generated ID:", randomId);
console.log("Generated Email:", randomEmail);`,
  },
  {
    labelKey: 'exPreConsoleDebug',
    code: `// Console log for debugging
console.log("Request URL:", pm.request.url);
console.log("Request Method:", pm.request.method);
console.log("Request Headers:", pm.request.headers);
console.log("Environment variable:", pm.environment.get("token"));`,
  },
];

export const POST_SCRIPT_EXAMPLES: ScriptExample[] = [
  {
    labelKey: 'exPostStatusAssert',
    code: `// Assert response status code
pm.test("Status code is 200", function () {
  pm.expect(pm.response.code).to.equal(200);
});

pm.test("Status code is 2xx", function () {
  pm.expect(pm.response.code).to.be.within(200, 299);
});

pm.test("Status code is not 404", function () {
  pm.expect(pm.response.code).to.not.equal(404);
});`,
  },
  {
    labelKey: 'exPostBodyAssert',
    code: `// Assert response body
pm.test("Response contains required field", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("id");
  pm.expect(data).to.have.property("name");
});

pm.test("Response field has correct type", function () {
  const data = pm.response.json();
  pm.expect(data.id).to.be.a("number");
  pm.expect(data.name).to.be.a("string");
});

pm.test("Response field has correct value", function () {
  const data = pm.response.json();
  pm.expect(data.status).to.equal("active");
  pm.expect(data.age).to.be.above(18);
});`,
  },
  {
    labelKey: 'exPostHeaderAssert',
    code: `// Assert response headers
pm.test("Response has content-type", function () {
  pm.expect(pm.response.headers.get("content-type")).to.include("application/json");
});

pm.test("Response has authorization header", function () {
  pm.expect(pm.response.headers.has("x-auth-token")).to.be.true;
});`,
  },
  {
    labelKey: 'exPostParseJson',
    code: `// Parse JSON response and extract data
const jsonData = pm.response.json();
console.log("Full response:", jsonData);
console.log("User ID:", jsonData.id);
console.log("User name:", jsonData.name);

// Extract nested data
const user = jsonData.data.user;
console.log("User email:", user.email);
console.log("User created at:", user.createdAt);`,
  },
  {
    labelKey: 'exPostExtractSave',
    code: `// Extract data from response and save to environment
const data = pm.response.json();

// Save simple values
pm.environment.set("userId", data.id);
pm.environment.set("token", data.accessToken);
pm.environment.set("refreshToken", data.refreshToken);

// Save nested values
pm.environment.set("userEmail", data.user.email);
pm.environment.set("userRole", data.user.role);

console.log("Saved userId:", pm.environment.get("userId"));`,
  },
  {
    labelKey: 'exPostCondAssert',
    code: `// Conditional assertions
pm.test("Check response based on status", function () {
  const data = pm.response.json();
  
  if (data.status === "success") {
    pm.expect(data.data).to.exist;
    pm.expect(data.data.id).to.be.a("number");
  } else if (data.status === "error") {
    pm.expect(data.message).to.exist;
    pm.expect(data.errorCode).to.be.a("number");
  }
});

pm.test("Validate array elements", function () {
  const data = pm.response.json();
  const items = data.items;
  
  pm.expect(items).to.be.an("array");
  items.forEach(item => {
    pm.expect(item).to.have.property("id");
    pm.expect(item.id).to.be.a("number");
  });
});`,
  },
  {
    labelKey: 'exPostTimeAssert',
    code: `// Assert response time
pm.test("Response time is less than 1 second", function () {
  pm.expect(pm.response.responseTime).to.be.below(1000);
});

pm.test("Response time is acceptable", function () {
  pm.expect(pm.response.responseTime).to.be.within(100, 2000);
});`,
  },
  {
    labelKey: 'exPostTransform',
    code: `// Transform and calculate response data
const data = pm.response.json();

// Calculate averages
const users = data.users;
const totalAge = users.reduce((sum, user) => sum + user.age, 0);
const averageAge = totalAge / users.length;

pm.environment.set("averageAge", averageAge);
console.log("Average age:", averageAge);

// Filter data
const activeUsers = users.filter(u => u.status === "active");
console.log("Active users count:", activeUsers.length);

// Map to new format
const userNames = users.map(u => u.name).join(", ");
console.log("All user names:", userNames);`,
  },
  {
    labelKey: 'exPostLoopSave',
    code: `// Loop through response array and save values
const data = pm.response.json();

const users = data.users;
users.forEach((user, index) => {
  // Save each user ID with index
  pm.environment.set("userId_" + index, user.id);
  
  if (index === 0) {
    // Save first user as default
    pm.environment.set("defaultUserId", user.id);
  }
});

console.log("Saved " + users.length + " user IDs");`,
  },
  {
    labelKey: 'exPostGetData',
    code: `// Parse JSON response
const jsonData = pm.response.json();
console.log("Response:", jsonData);`,
  },
  {
    labelKey: 'exPostSetEnvVar',
    code: `// Save response data to environment
const jsonData = pm.response.json();
pm.environment.set("token", jsonData.token);`,
  },
  {
    labelKey: 'exPostSendRequest',
    code: `// Send additional request
pm.sendRequest({
  url: "https://api.example.com/endpoint",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
}, function (err, response) {
  if (err) {
    console.error(err);
  } else {
    console.log("Response:", response.json());
  }
});`,
  },
  {
    labelKey: 'exPostConsoleLog',
    code: `// Console log
console.log("Status:", pm.response.code);
console.log("Body:", pm.response.text());`,
  },
];
