const path = require("path")
const fs = require("fs")

// Simulate the path resolution used in the test
const testDirname = path.join(__dirname, "out/suite")
console.log("Test __dirname:", testDirname)

// Path used in the test
const testFilePath = path.join(testDirname, "../../../fixtures/test-upload-file.txt")
console.log("Test file path:", testFilePath)
console.log("File exists:", fs.existsSync(testFilePath))

// Normalize the path
const normalizedPath = path.normalize(testFilePath)
console.log("Normalized path:", normalizedPath)
console.log("File exists:", fs.existsSync(normalizedPath))

// Resolve the path
const resolvedPath = path.resolve(testFilePath)
console.log("Resolved path:", resolvedPath)
console.log("File exists:", fs.existsSync(resolvedPath))

// Print current working directory
console.log("Current working directory:", process.cwd())

// Print __dirname
console.log("__dirname:", __dirname)

// Check if the out/suite directory exists
const outSuiteDir = path.join(__dirname, "out/suite")
console.log("out/suite directory exists:", fs.existsSync(outSuiteDir))

// List files in the fixtures directory
const fixturesDir = path.join(__dirname, "fixtures")
if (fs.existsSync(fixturesDir)) {
	console.log("Files in fixtures directory:")
	fs.readdirSync(fixturesDir).forEach((file) => {
		console.log("  -", file)
	})
} else {
	console.log("Fixtures directory does not exist:", fixturesDir)
}
