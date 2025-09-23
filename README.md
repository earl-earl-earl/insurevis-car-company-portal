# Car Company Web Portal Integration

This web portal allows car manufacturers to integrate with the InsureVis mobile app, providing vehicle verification, document validation, and warranty services.

## Features

### 🔍 **Document Verification**
- Upload and verify vehicle registration documents
- VIN validation against manufacturer database
- Document authenticity checking
- Real-time verification results

### 🚗 **Vehicle Database Management**
- Complete vehicle database with VIN lookup
- Add/edit vehicle information
- Track warranty status
- Search and filter capabilities

### 🛡️ **Warranty & Recall Services**
- Check warranty status by VIN
- Active recall notifications
- Coverage details and expiry dates
- Service history tracking

### 🔗 **API Integration**
- RESTful API for mobile app integration
- Real-time data synchronization
- Secure authentication
- Rate limiting and monitoring

## Setup Instructions

### 1. Prerequisites
- Web server (Apache/Nginx)
- Node.js (for backend API)
- SSL certificate for secure connections

### 2. Installation
1. Copy files to your web server directory
2. Configure API endpoints in `script.js`
3. Update authentication tokens
4. Set up CORS for mobile app integration

### 3. Configuration
Update the API base URL in `script.js`:
```javascript
this.apiBaseUrl = 'https://your-domain.com/api';
```

## API Endpoints

### Vehicle Information
- `GET /api/vehicle/{vin}` - Get vehicle details
- `GET /api/vehicle/{vin}/specs` - Get technical specifications

### Document Verification
- `POST /api/verify/document` - Verify uploaded documents
- `GET /api/verify/status/{id}` - Check verification status

### Warranty Services
- `GET /api/warranty/{vin}` - Check warranty status
- `POST /api/warranty/claim` - Submit warranty claim

### Recalls
- `POST /api/recall/check` - Check for active recalls
- `GET /api/recalls/active` - Get all active recalls

## Mobile App Integration

The InsureVis mobile app can integrate with this portal through the `CarCompanyApiService` class:

```dart
// Verify vehicle information
final vehicleInfo = await CarCompanyApiService.verifyVehicleInfo(vin);

// Check warranty status
final warranty = await CarCompanyApiService.checkWarranty(vin);

// Submit documents for verification
final result = await CarCompanyApiService.submitDocumentForVerification(
  vin: vin,
  documentType: 'registration',
  documentPath: documentPath,
  assessmentId: assessmentId,
);
```

## Security Features

- **Authentication**: Bearer token authentication
- **HTTPS**: All communications encrypted
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: VIN format validation and document type checking
- **Access Control**: Role-based access for different user types

## Dashboard Features

### Real-time Statistics
- Documents verified today
- Vehicles in database
- Active warranties
- API request volume

### Activity Monitoring
- Recent verification activities
- System alerts and notifications
- Performance metrics
- Error tracking

## File Structure

```
web_portal/
├── index.html          # Main portal interface
├── styles.css          # Styling and responsive design
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Support

For technical support or integration questions, contact the InsureVis development team.
