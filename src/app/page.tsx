"use client";

import React, { useState, useEffect } from 'react';
import Header from './components/header';
import Footer from './components/footer';
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Scanner } from '@yudiel/react-qr-scanner';

interface GoldCertificate {
  id: string;
  status: string;
}

interface VerificationResult {
  isValid: boolean;
  error?: string;
  certificate?: GoldCertificate;
}

interface ScanResult {
  rawValue: string;
}

interface QRData {
  certificateId: string;
  userId: string;
  amount: number;
  expiryTimestamp: number;
  nonce: string;
}

function App() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationResult | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase environment variables are missing');
      return;
    }

    try {
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      setSupabase(supabaseClient);
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
    }
  }, []);

  const verifyRedemptionQR = async (qrCode: string): Promise<VerificationResult> => {
    if (!supabase) {
      return { isValid: false, error: 'Database connection not initialized' };
    }

    try {
      const qrData: QRData = JSON.parse(qrCode);

      if (Date.now() > qrData.expiryTimestamp) {
        return { isValid: false, error: 'QR code expired' };
      }

      const { data: nonceRecord, error: nonceError } = await supabase
        .from('RedemptionNonce')
        .select('*')
        .eq('nonce', qrData.nonce)
        .single();

      console.log('QR Data Nonce:', qrData.nonce);
      console.log('Nonce Record:', nonceRecord);
      console.log('Nonce Error:', nonceError);

      if (!nonceRecord || nonceRecord.used) {
        return { isValid: false, error: 'Invalid or used QR code' };
      }

      const { data: certificate } = await supabase
        .from('GoldCertificate')
        .select()
        .eq('id', qrData.certificateId)
        .eq('status', 'ACTIVE')
        .single();

      if (!certificate) {
        return { isValid: false, error: 'Certificate not found or already redeemed' };
      }

      console.log('Processing redemption for certificate:', qrData.certificateId);
      console.log('Using nonce:', qrData.nonce);
      
      const { data, error } = await supabase.rpc('process_redemption', {
        p_certificate_id: qrData.certificateId,
        p_nonce: qrData.nonce
      });

      console.log('Redemption response:', data);

      if (error) {
        console.error('Redemption error:', error);
        return { isValid: false, error: 'Failed to process redemption' };
      }

      // Double-check the certificate status
      const { data: updatedCertificate, error: checkError } = await supabase
        .from('GoldCertificate')
        .select('status')
        .eq('id', qrData.certificateId)
        .single();

      console.log('Final certificate check:', {
        status: updatedCertificate?.status,
        error: checkError
      });

      if (updatedCertificate?.status !== 'REDEEMED') {
        console.error('Certificate status not updated correctly');
        return { isValid: false, error: 'Failed to update certificate status' };
      }

      return {
        isValid: true,
        certificate
      };
    } catch (error) {
      console.error('QR Verification error:', error);
      return { isValid: false, error: 'Invalid QR code format' };
    }
  } 

  const handleScan = async (scanResult: ScanResult[]) => {
    if (scanResult?.[0]?.rawValue) {
      const rawValue = scanResult[0].rawValue;
      setScanResult(rawValue);
      try {
        const verification = await verifyRedemptionQR(rawValue);
        setVerificationStatus(verification);
      } catch (err: unknown) {
        console.error('Scan error:', err);
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
        
        {scanResult && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
            <div className="font-semibold mb-1 text-black">Scanned Data:</div>
            <div className="break-all text-black">{scanResult}</div>
          </div>
        )}

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