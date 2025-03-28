const path = require("path")
const fs = require("fs")

// Path used in the test
const testFilePath = path.join(__dirname, "fixtures/test-upload-file.txt")
console.log("Test file path:", testFilePath)
console.log("File exists:", fs.existsSync(testFilePath))

// Try different path resolutions
const absolutePath = path.resolve(__dirname, "fixtures/test-upload-file.txt")
console.log("Absolute path:", absolutePath)
console.log("File exists:", fs.existsSync(absolutePath))

// Try with ../fixtures
const parentPath = path.join(__dirname, "../fixtures/test-upload-file.txt")
console.log("Parent path:", parentPath)
console.log("File exists:", fs.existsSync(parentPath))

// Try with ../../fixtures
const grandparentPath = path.join(__dirname, "../../fixtures/test-upload-file.txt")
console.log("Grandparent path:", grandparentPath)
console.log("File exists:", fs.existsSync(grandparentPath))

// Try with ../../../fixtures
const greatGrandparentPath = path.join(__dirname, "../../../fixtures/test-upload-file.txt")
console.log("Great grandparent path:", greatGrandparentPath)
console.log("File exists:", fs.existsSync(greatGrandparentPath))

// List files in the fixtures directory if it exists
const fixturesDir = path.join(__dirname, "fixtures")
if (fs.existsSync(fixturesDir)) {
	console.log("Files in fixtures directory:")
	fs.readdirSync(fixturesDir).forEach((file) => {
		console.log("  -", file)
	})
} else {
	console.log("Fixtures directory does not exist:", fixturesDir)
}

// Try with ../fixtures
const parentFixturesDir = path.join(__dirname, "../fixtures")
if (fs.existsSync(parentFixturesDir)) {
	console.log("Files in ../fixtures directory:")
	fs.readdirSync(parentFixturesDir).forEach((file) => {
		console.log("  -", file)
	})
} else {
	console.log("Parent fixtures directory does not exist:", parentFixturesDir)
}

// Try with ../../fixtures
const grandparentFixturesDir = path.join(__dirname, "../../fixtures")
if (fs.existsSync(grandparentFixturesDir)) {
	console.log("Files in ../../fixtures directory:")
	fs.readdirSync(grandparentFixturesDir).forEach((file) => {
		console.log("  -", file)
	})
} else {
	console.log("Grandparent fixtures directory does not exist:", grandparentFixturesDir)
}

// Try with ../../../fixtures
const greatGrandparentFixturesDir = path.join(__dirname, "../../../fixtures")
if (fs.existsSync(greatGrandparentFixturesDir)) {
	console.log("Files in ../../../fixtures directory:")
	fs.readdirSync(greatGrandparentFixturesDir).forEach((file) => {
		console.log("  -", file)
	})
} else {
	console.log("Great grandparent fixtures directory does not exist:", greatGrandparentFixturesDir)
}

// Print current working directory
console.log("Current working directory:", process.cwd())

// Print __dirname
console.log("__dirname:", __dirname)
