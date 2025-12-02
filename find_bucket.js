// Test different bucket names that might exist
const { supabase } = require('./supabase_config');

async function findCorrectBucket() {
  console.log('🔍 Searching for the correct bucket name...');
  
  const possibleBuckets = [
    'insurevis-documents',
    'documents', 
    'insurevis_documents',
    'uploads',
    'files',
    'storage',
    'bucket'
  ];
  
  try {
    // First try to list all buckets
    console.log('1. Trying to list all buckets...');
    const { data: allBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (!listError && allBuckets && allBuckets.length > 0) {
      console.log('✅ Found buckets:');
      allBuckets.forEach(bucket => {
        console.log(`   - ${bucket.name} (public: ${bucket.public})`);
      });
      return allBuckets[0].name; // Return the first bucket name
    }
    
    if (listError) {
      console.log('❌ List buckets error:', listError.message);
    }
    
    // Try each possible bucket name by attempting to list files
    console.log('2. Testing possible bucket names...');
    for (const bucketName of possibleBuckets) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 1 });
        
        if (!error) {
          console.log(`✅ Found working bucket: ${bucketName}`);
          return bucketName;
        }
      } catch (e) {
        // Continue to next bucket name
      }
    }
    
    console.log('❌ No working bucket found');
    console.log('');
    console.log('📋 Please create a bucket in Supabase Dashboard:');
    console.log('1. Go to Storage tab');
    console.log('2. Click "New bucket"');
    console.log('3. Name it "insurevis-documents"');
    console.log('4. Set appropriate permissions');
    
    return null;
    
  } catch (error) {
    console.log('❌ Error finding bucket:', error.message);
    return null;
  }
}

findCorrectBucket().then(bucketName => {
  if (bucketName) {
    console.log('');
    console.log(`🎯 Use this bucket name: ${bucketName}`);
  }
});
