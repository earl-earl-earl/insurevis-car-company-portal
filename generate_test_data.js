const fs = require('fs');
const path = require('path');

// Test data generator for file transmission tests
class TestDataGenerator {
  constructor() {
    this.testDir = path.join(__dirname, 'test_files');
    this.uploadDir = path.join(__dirname, 'uploads');
    this.setupDirectories();
  }

  setupDirectories() {
    // Create test_files directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
      console.log('✅ Created test_files directory');
    }

    // Create uploads directory
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }
  }

  // Generate a fake JPEG file with proper header
  generateFakeJPEG(filename, sizeKB = 10) {
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
    ]);
    
    const dataSize = (sizeKB * 1024) - jpegHeader.length - 2; // Reserve 2 bytes for end marker
    const randomData = Buffer.alloc(dataSize);
    
    // Fill with random data
    for (let i = 0; i < dataSize; i++) {
      randomData[i] = Math.floor(Math.random() * 256);
    }
    
    const jpegEnd = Buffer.from([0xFF, 0xD9]);
    const completeFile = Buffer.concat([jpegHeader, randomData, jpegEnd]);
    
    const filepath = path.join(this.testDir, filename);
    fs.writeFileSync(filepath, completeFile);
    
    return filepath;
  }

  // Generate a fake PDF file with proper header
  generateFakePDF(filename, sizeKB = 5) {
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = `
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document for InsureVis) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000189 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
285
%%EOF
`;

    // Pad to desired size
    const currentSize = pdfHeader.length + pdfContent.length;
    const targetSize = sizeKB * 1024;
    const paddingNeeded = Math.max(0, targetSize - currentSize);
    const padding = '% Padding: ' + 'X'.repeat(paddingNeeded - 12) + '\n';
    
    const completeFile = pdfHeader + pdfContent + padding;
    
    const filepath = path.join(this.testDir, filename);
    fs.writeFileSync(filepath, completeFile);
    
    return filepath;
  }

  // Generate test text file
  generateTextFile(filename, content = 'Test file content', sizeKB = 1) {
    const targetSize = sizeKB * 1024;
    let fileContent = content;
    
    // Repeat content to reach target size
    while (fileContent.length < targetSize) {
      fileContent += '\n' + content + ' (repeated)';
    }
    
    // Trim to exact size
    fileContent = fileContent.substring(0, targetSize);
    
    const filepath = path.join(this.testDir, filename);
    fs.writeFileSync(filepath, fileContent);
    
    return filepath;
  }

  // Generate all standard test files
  generateAllTestFiles() {
    console.log('🔧 Generating test files...\n');
    
    const files = [
      // Small test images
      { type: 'jpeg', name: 'test_damage_image.jpg', size: 15 },
      { type: 'jpeg', name: 'test_image_1.jpg', size: 12 },
      { type: 'jpeg', name: 'test_image_2.jpg', size: 18 },
      { type: 'jpeg', name: 'test_image_3.jpg', size: 22 },
      
      // Document files
      { type: 'pdf', name: 'test_document.pdf', size: 25 },
      { type: 'pdf', name: 'insurance_claim.pdf', size: 35 },
      { type: 'pdf', name: 'vehicle_registration.pdf', size: 15 },
      
      // Text files for testing
      { type: 'text', name: 'test_data.txt', size: 5 },
      { type: 'text', name: 'assessment_data.json', size: 2 },
      
      // Large files for performance testing
      { type: 'jpeg', name: 'large_image.jpg', size: 500 },
      { type: 'pdf', name: 'large_document.pdf', size: 1000 },
    ];

    const generatedFiles = [];

    files.forEach(file => {
      try {
        let filepath;
        
        switch (file.type) {
          case 'jpeg':
            filepath = this.generateFakeJPEG(file.name, file.size);
            break;
          case 'pdf':
            filepath = this.generateFakePDF(file.name, file.size);
            break;
          case 'text':
            const content = file.name.includes('json') ? 
              JSON.stringify({
                testData: true,
                assessmentId: 'test_123',
                damageType: 'dent',
                severity: 'moderate',
                estimatedCost: 1250.00
              }, null, 2) : 
              'Test file content for file transmission testing';
            filepath = this.generateTextFile(file.name, content, file.size);
            break;
        }
        
        const stats = fs.statSync(filepath);
        const actualSizeKB = (stats.size / 1024).toFixed(1);
        
        console.log(`✅ Generated: ${file.name} (${actualSizeKB} KB)`);
        generatedFiles.push({
          name: file.name,
          path: filepath,
          type: file.type,
          size: actualSizeKB + ' KB'
        });
        
      } catch (error) {
        console.log(`❌ Failed to generate ${file.name}: ${error.message}`);
      }
    });

    // Generate manifest file
    const manifest = {
      generated_at: new Date().toISOString(),
      total_files: generatedFiles.length,
      files: generatedFiles,
      usage: {
        small_files: generatedFiles.filter(f => parseFloat(f.size) < 50),
        medium_files: generatedFiles.filter(f => parseFloat(f.size) >= 50 && parseFloat(f.size) < 200),
        large_files: generatedFiles.filter(f => parseFloat(f.size) >= 200)
      }
    };

    const manifestPath = path.join(this.testDir, 'file_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n📄 Generated manifest: file_manifest.json`);
    console.log(`📊 Total files created: ${generatedFiles.length}`);
    console.log(`📁 Test files directory: ${this.testDir}`);
    
    return generatedFiles;
  }

  // Clean up test files
  cleanupTestFiles() {
    if (fs.existsSync(this.testDir)) {
      const files = fs.readdirSync(this.testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.testDir, file));
      });
      fs.rmdirSync(this.testDir);
      console.log('🧹 Cleaned up test files directory');
    }
  }

  // Clean up upload files
  cleanupUploads() {
    if (fs.existsSync(this.uploadDir)) {
      const files = fs.readdirSync(this.uploadDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.uploadDir, file));
      });
      console.log(`🧹 Cleaned up ${files.length} uploaded files`);
    }
  }

  // Get test file info
  getTestFileInfo() {
    const manifestPath = path.join(this.testDir, 'file_manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return manifest;
    }
    
    return null;
  }
}

// Command line interface
if (require.main === module) {
  const generator = new TestDataGenerator();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Test Data Generator for File Transmission Tests');
    console.log('='.repeat(50));
    console.log('\nUsage: node generate_test_data.js [options]');
    console.log('\nOptions:');
    console.log('  --generate, -g    Generate all test files');
    console.log('  --cleanup, -c     Clean up test files');
    console.log('  --info, -i        Show test file information');
    console.log('  --help, -h        Show this help message');
    console.log('\nExamples:');
    console.log('  node generate_test_data.js -g    # Generate test files');
    console.log('  node generate_test_data.js -c    # Clean up test files');
    console.log('  node generate_test_data.js -i    # Show file info');
    process.exit(0);
  }
  
  if (args.includes('--generate') || args.includes('-g')) {
    generator.generateAllTestFiles();
  } else if (args.includes('--cleanup') || args.includes('-c')) {
    generator.cleanupTestFiles();
    generator.cleanupUploads();
  } else if (args.includes('--info') || args.includes('-i')) {
    const info = generator.getTestFileInfo();
    if (info) {
      console.log('📊 Test File Information:');
      console.log('='.repeat(30));
      console.log(`Generated: ${info.generated_at}`);
      console.log(`Total files: ${info.total_files}`);
      console.log(`Small files (< 50KB): ${info.usage.small_files.length}`);
      console.log(`Medium files (50-200KB): ${info.usage.medium_files.length}`);
      console.log(`Large files (> 200KB): ${info.usage.large_files.length}`);
      console.log('\nFiles:');
      info.files.forEach(file => {
        console.log(`  • ${file.name} (${file.size})`);
      });
    } else {
      console.log('❌ No test files found. Run with --generate to create them.');
    }
  } else {
    console.log('📁 Test Data Generator');
    console.log('Run with --help for usage instructions');
    console.log('Quick start: node generate_test_data.js --generate');
  }
}

module.exports = TestDataGenerator;
