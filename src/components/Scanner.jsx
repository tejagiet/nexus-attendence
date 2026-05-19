import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { ArrowLeft, MapPin, XCircle, Loader2 } from 'lucide-react';

const GEOFENCE_RADIUS_METERS = 100;

// Haversine formula
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export default function Scanner() {
  const [scanning, setScanning] = useState(true);
  const [status, setStatus] = useState('scanning'); // scanning, processing, success, error
  const [message, setMessage] = useState('');
  const [distance, setDistance] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Only initialize scanner if we are in 'scanning' mode
    if (status !== 'scanning') return;

    let scanner = new Html5Qrcode("qr-reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    
    scanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        // Stop scanning after first read
        scanner.stop().then(() => {
          setScanning(false);
          handleScan(decodedText);
        }).catch(err => console.error("Failed to stop scanner", err));
      },
      (errorMessage) => {
        // parse errors, ignore for now
      }
    ).catch(err => {
      console.error("Error starting scanner", err);
      setStatus('error');
      setMessage('Could not access camera. Please check permissions.');
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [status]);

  const handleScan = async (url) => {
    try {
      setStatus('processing');
      setMessage('Acquiring secure GPS location...');
      
      // Extract anchorId. It might be a full URL (https://.../scan?anchorId=UUID) 
      // or it might just be the raw UUID string from the generator.
      let anchorId;
      try {
        const urlObj = new URL(url);
        anchorId = urlObj.searchParams.get('anchorId');
      } catch (e) {
        // If it's not a valid URL, assume the scanned text is the raw anchorId
        anchorId = url;
      }
      
      if (!anchorId) throw new Error('Invalid QR Code. No anchor ID found.');

      // 1. Get user location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000, // Increased timeout to 30 seconds for slower GPS locks
          maximumAge: 5000 // Allow up to 5 seconds of cached location to speed up resolution
        });
      });

      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;

      setMessage('Validating geofence...');

      // 2. Get anchor location and session details
      // Note: Implementation plan assumes `nexus_attendance_sessions` has anchor_id, latitude, longitude and is_active.
      // Based on SQL we know it has anchor_id, latitude, longitude. We will assume is_active exists or we just use the latest.
      const { data: sessionData, error: sessionError } = await supabase
        .from('nexus_attendance_sessions')
        .select('id, latitude, longitude')
        .eq('anchor_id', anchorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !sessionData) throw new Error('Session not found or inactive.');
      if (!sessionData.latitude || !sessionData.longitude) throw new Error('Session has no location data.');

      // 3. Calculate distance
      const dist = getDistanceFromLatLonInMeters(
        userLat, userLon,
        sessionData.latitude, sessionData.longitude
      );
      setDistance(Math.round(dist));

      // 4. Validate geofence
      if (dist > GEOFENCE_RADIUS_METERS) {
        throw new Error(`You are too far from the center. Current distance: ${Math.round(dist)} meters. Attendance must be marked within ${GEOFENCE_RADIUS_METERS} meters.`);
      }

      setMessage('Recording attendance...');

      // 5. Insert Log
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Authentication error.');

      const { error: logError } = await supabase
        .from('nexus_attendance_logs')
        .insert({
          user_id: userData.user.id,
          session_id: sessionData.id,
          status: 'Present'
        });

      if (logError) {
        if (logError.code === '23505') throw new Error('Attendance already marked for this session.');
        throw logError;
      }

      // 6. Success
      setStatus('success');
      triggerConfetti();

    } catch (err) {
      console.error(err);
      setStatus('error');
      
      // Handle Geolocation errors specifically
      if (err instanceof GeolocationPositionError) {
        if (err.code === 1) setMessage('Location access denied. Please enable location services in your browser settings.');
        else if (err.code === 2) setMessage('Location unavailable. Check your device GPS.');
        else if (err.code === 3) setMessage('Location request timed out. Please try again.');
      } else {
        setMessage(err.message || 'Verification Failed');
      }
    }
  };

  const triggerConfetti = () => {
    var duration = 3 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    var interval = setInterval(function() {
      var timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      var particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, particleCount,
        origin: { x: Math.random(), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const resetScanner = () => {
    setDistance(null);
    setMessage('');
    setStatus('scanning');
    setScanning(true);
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-white/5 relative z-10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/5 rounded-full text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-white font-medium">Scan QR Code</h2>
        <div className="w-9"></div> {/* Spacer for centering */}
      </header>

      <main className="flex-1 flex flex-col relative">
        {status === 'scanning' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative bg-black/50">
              <div id="qr-reader" className="w-full h-full object-cover"></div>
              {/* Custom Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/60 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-nexus-primary rounded-3xl relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-nexus-primary rounded-tl-3xl"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-nexus-primary rounded-tr-3xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-nexus-primary rounded-bl-3xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-nexus-primary rounded-br-3xl"></div>
                </div>
              </div>
            </div>
            <div className="p-8 text-center text-nexus-muted bg-nexus-bg">
              <p>Position the QR code within the frame to scan.</p>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 size={48} className="text-nexus-primary animate-spin mb-6" />
            <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
            <p className="text-nexus-muted">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-nexus-success/20 text-nexus-success rounded-full flex items-center justify-center mb-6 border border-nexus-success/30">
              <MapPin size={48} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Verified!</h3>
            <p className="text-nexus-muted mb-8">Your attendance has been successfully recorded.</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="bg-nexus-success text-black font-semibold px-8 py-3 rounded-xl hover:bg-nexus-success/90 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-nexus-error/20 text-nexus-error rounded-full flex items-center justify-center mb-6 border border-nexus-error/30">
              <XCircle size={40} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Verification Failed</h3>
            <div className="bg-nexus-error-bg border border-nexus-error/20 rounded-xl p-4 mb-8 text-nexus-error text-sm max-w-sm">
              {message}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-white/10 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={resetScanner}
                className="bg-nexus-error text-black font-medium px-6 py-3 rounded-xl hover:bg-nexus-error/90 transition-colors"
              >
                Retry Scan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
