"use client";

import React, { useState } from 'react';
import Header from './components/header';
import Footer from './components/footer';
import { createClient } from '@supabase/supabase-js'
import { Scanner } from '@yudiel/react-qr-scanner';

interface VerificationResult {
  isValid: boolean;
  error?: string;
  certificate?: any; // You might want to type this more specifically based on your certificate structure
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const verifyRedemptionQR = async (qrCode: string): Promise<VerificationResult> => {
  try {
    const qrData = JSON.parse(qrCode);

    // Verify signature
    const dataToVerify = JSON.stringify({ ...qrData, signature: undefined });
    const expectedSignature = btoa(encodeURIComponent(dataToVerify + process.env.SECRET_KEY!));

    if(qrData.signature !== expectedSignature) {
      return { isValid: false, error: 'Invalid signature' };
    }

    // Check expiry
    if (Date.now() > qrData.expiryTimestamp) {
      return { isValid: false, error: 'QR code expired' };
    }

    // Check if nonce was used
    const { data: nonceRecord } = await supabase
      .from('RedemptionNonce')
      .select('*')
      .eq('nonce', qrData.nonce)
      .single();

    if (!nonceRecord || nonceRecord.used) {
      return { isValid: false, error: 'Invalid or used QR code' };
    }

    const { data: certificate } = await supabase
      .from('gold_certificate')
      .select()
      .eq('id', qrData.certificateId)
      .eq('status', 'active')
      .single();

    if (!certificate) {
      return { isValid: false, error: 'Certificate not found or already redeemed' };
    }

    // Mark nonce as used
    await supabase
      .from('redemption_nonce')
      .update({ used: true })
      .eq('nonce', qrData.nonce);

    return {
      isValid: true,
      certificate
    };
  } catch (error) {
    console.error('QR Verification error:', error);
    return { isValid: false, error: 'Invalid QR code format' };
  }
}

function App() {
  const [result, setResult] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationResult | null>(null);

  const handleScan = async (result: any) => {
    if (result?.[0]?.rawValue) {
      setResult(result[0].rawValue);
      try {
        const verification = await verifyRedemptionQR(result[0].rawValue);
        setVerificationStatus(verification);
      } catch (error) {
        setVerificationStatus({ isValid: false, error: 'Failed to verify QR code' });
      }
    }
  };

  return (
    <div className="App">
      <Header />
      <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 w-full px-4 md:w-1/3 lg:w-1/4">
        <Scanner
          styles={{
            container: {
              width: '100%',
              height: '350px',
            }
          }}
          onScan={handleScan}
        />
        {verificationStatus && (
          <div className={`mt-4 text-center ${verificationStatus.isValid ? 'text-green-600' : 'text-red-600'}`}>
            {verificationStatus.isValid 
              ? 'Certificate verified successfully!' 
              : `Verification failed: ${verificationStatus.error}`}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default App;
