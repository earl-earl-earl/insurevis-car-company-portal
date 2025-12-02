require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { supabase, supabaseUrl, supabaseAnonKey } = require('./supabase_config');

const app = express();
const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR)); // Serve static assets from /public

// File upload configuration - using memory storage for Supabase upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Mock database
const vehicles = [
  {
    vin: 'ABC123456789DEFGH',
    make: 'Toyota',
    model: 'Camry',
    year: 2024,
    status: 'active',
    warranty: {
      status: 'active',
      type: 'comprehensive',
      startDate: '2024-01-15',
      endDate: '2027-01-15',
      coverage: ['engine', 'transmission', 'electrical']
    }
  },
  {
    vin: 'DEF987654321HGFED',
    make: 'Honda',
    model: 'Civic',
    year: 2023,
    status: 'active',
    warranty: {
      status: 'active',
      type: 'basic',
      startDate: '2023-06-01',
      endDate: '2026-06-01',
      coverage: ['engine', 'transmission']
    }
  }
];

const recalls = [
  {
    id: 'RC-2024-001',
    title: 'Airbag Sensor Issue',
    severity: 'medium',
    affected_vins: ['ABC123456789*'],
    description: 'Potential airbag sensor malfunction',
    remedy: 'Sensor replacement at authorized dealer'
  }
];

// Routes

// Get Supabase configuration for frontend
app.get('/api/config/supabase', (req, res) => {
  res.json({
    success: true,
    data: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    }
  });
});

// Get vehicle information
app.get('/api/vehicle/:vin', (req, res) => {
  const { vin } = req.params;
  const vehicle = vehicles.find(v => v.vin === vin.toUpperCase());
  
  if (vehicle) {
    res.json({
      success: true,
      data: vehicle
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Vehicle not found'
    });
  }
});

// Check warranty status
app.get('/api/warranty/:vin', (req, res) => {
  const { vin } = req.params;
  const vehicle = vehicles.find(v => v.vin === vin.toUpperCase());
  
  if (vehicle) {
    res.json({
      success: true,
      data: {
        vin: vehicle.vin,
        warranty: vehicle.warranty
      }
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Vehicle not found'
    });
  }
});

// Check for recalls
app.post('/api/recall/check', (req, res) => {
  const { vin } = req.body;
  
  const vehicleRecalls = recalls.filter(recall => 
    recall.affected_vins.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return vin.startsWith(prefix);
      }
      return pattern === vin;
    })
  );
  
  res.json({
    success: true,
    data: {
      recalls: vehicleRecalls
    }
  });
});

// Verify document
app.post('/api/verify/document', upload.single('document'), async (req, res) => {
  console.log('📋 Document verification request received');
  console.log('Body:', req.body);
  console.log('File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
  
  const { vin, document_type, assessment_id } = req.body;
  const file = req.file;
  
  if (!file || !vin || !document_type) {
    console.log('❌ Missing required fields');
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
  
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test Supabase connection first
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Supabase connection failed:', bucketsError);
      return res.status(500).json({
        success: false,
        error: `Supabase connection failed: ${bucketsError.message}`
      });
    }
    
    console.log('✅ Supabase connected. Available buckets:', buckets.map(b => b.name));
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    const filePath = `documents/${filename}`;
    
    console.log(`📤 Uploading file to Supabase Storage: ${filePath}`);
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('insurevis-documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          vin: vin,
          document_type: document_type,
          assessment_id: assessment_id,
          original_name: file.originalname
        }
      });
    
    if (uploadError) {
      console.error('❌ Supabase upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: `File upload failed: ${uploadError.message}`
      });
    }
    
    console.log('✅ File uploaded to Supabase Storage:', uploadData.path);
    
    // Mock verification logic (in real implementation, this would analyze the document)
    const isValid = Math.random() > 0.2; // 80% success rate
    const confidence = isValid ? (85 + Math.random() * 15).toFixed(1) : (20 + Math.random() * 30).toFixed(1);
    const status = isValid ? 'VERIFIED' : 'REJECTED';
    const details = isValid ? 
      'Document successfully verified against manufacturer records' :
      'Document could not be verified - possible forgery detected';
    
    // Store verification record in Supabase database
    const verificationRecord = {
      verification_id: timestamp.toString(),
      vin: vin,
      document_type: document_type,
      assessment_id: assessment_id,
      file_path: uploadData.path,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      is_valid: isValid,
      status: status,
      confidence: parseFloat(confidence),
      details: details,
      verified_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Saving verification record to database...');
    
    const { data: dbData, error: dbError } = await supabase
      .from('document_verifications')
      .insert([verificationRecord])
      .select();
    
    if (dbError) {
      console.error('❌ Supabase database error:', dbError);
      // File was uploaded but database insert failed
      return res.status(500).json({
        success: false,
        error: `Database error: ${dbError.message}`
      });
    }
    
    console.log('✅ Verification record saved to Supabase database');
    console.log('🎉 Sending successful response');
    
    // Send response immediately (no setTimeout)
    res.json({
      success: true,
      data: {
        verification_id: verificationRecord.verification_id,
        vin: vin,
        document_type: document_type,
        file_name: file.originalname,
        file_size: file.size,
        file_path: uploadData.path,
        is_valid: isValid,
        status: status,
        confidence: confidence,
        details: details,
        verified_at: verificationRecord.verified_at,
        supabase_stored: true
      }
    });
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

// Submit assessment for validation
app.post('/api/assessment/validate', upload.array('images'), async (req, res) => {
  const { vin, assessment_data } = req.body;
  const images = req.files;
  
  if (!vin || !assessment_data) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
  
  try {
    const assessmentObj = JSON.parse(assessment_data);
    const timestamp = Date.now();
    const uploadedImages = [];
    
    // Upload all images to Supabase Storage
    if (images && images.length > 0) {
      console.log(`📤 Uploading ${images.length} images to Supabase Storage`);
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const filename = `${timestamp}-${i + 1}-${image.originalname}`;
        const filePath = `assessments/${filename}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('insurevis-documents')
          .upload(filePath, image.buffer, {
            contentType: image.mimetype,
            metadata: {
              vin: vin,
              assessment_id: assessmentObj.assessmentId || `assessment_${timestamp}`,
              image_index: i + 1,
              original_name: image.originalname
            }
          });
        
        if (uploadError) {
          console.error(`Error uploading image ${i + 1}:`, uploadError);
          return res.status(500).json({
            success: false,
            error: `Image upload failed: ${uploadError.message}`
          });
        }
        
        uploadedImages.push({
          path: uploadData.path,
          filename: filename,
          size: image.size,
          mimetype: image.mimetype
        });
      }
    }
    
    // Mock validation logic
    const isValid = Math.random() > 0.15; // 85% success rate
    const confidence = isValid ? (90 + Math.random() * 10).toFixed(1) : (40 + Math.random() * 40).toFixed(1);
    const recommendedAction = isValid ? 'PROCEED_WITH_CLAIM' : 'REQUIRE_INSPECTION';
    const notes = isValid ? 
      'Assessment appears consistent with vehicle specifications and typical damage patterns' :
      'Assessment may contain inconsistencies with vehicle specifications';
    
    // Store assessment validation record in Supabase database
    const validationRecord = {
      validation_id: timestamp.toString(),
      vin: vin,
      assessment_data: assessmentObj,
      image_count: uploadedImages.length,
      uploaded_images: uploadedImages,
      assessment_valid: isValid,
      confidence: parseFloat(confidence),
      recommended_action: recommendedAction,
      manufacturer_notes: notes,
      validated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    const { data: dbData, error: dbError } = await supabase
      .from('assessment_validations')
      .insert([validationRecord])
      .select();
    
    if (dbError) {
      console.error('Supabase database error:', dbError);
      return res.status(500).json({
        success: false,
        error: `Database error: ${dbError.message}`
      });
    }
    
    console.log('✅ Assessment validation record saved to Supabase database');
    
    setTimeout(() => {
      res.json({
        success: true,
        data: {
          validation_id: validationRecord.validation_id,
          vin: vin,
          assessment_valid: isValid,
          manufacturer_notes: notes,
          confidence: confidence,
          recommended_action: recommendedAction,
          images_uploaded: uploadedImages.length,
          supabase_stored: true,
          validated_at: validationRecord.validated_at
        }
      });
    }, 3000); // Simulate processing time
    
  } catch (error) {
    console.error('Assessment validation error:', error);
    if (error instanceof SyntaxError) {
      res.status(400).json({
        success: false,
        error: 'Invalid assessment data format'
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Internal server error: ${error.message}`
      });
    }
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Car Company API is running',
    timestamp: new Date().toISOString()
  });
});

// Serve the web portal
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Only start the server when this file is run directly (e.g. `node server.js`).
// When deployed to Vercel, the function in /api/ will import this module
// and should not start a listener.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚗 Car Company API Portal running on http://localhost:${PORT}`);
    console.log(`📊 Web Portal: http://localhost:${PORT}`);
    console.log(`🔗 API Endpoints: http://localhost:${PORT}/api/`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
});

module.exports = app;
