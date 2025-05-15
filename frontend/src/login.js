import React, { useState } from 'react';
import fingerprintIcon from '../images/fingerprint.svg';

const Login = ({ onLogin }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');

    const handleFingerprintScan = () => {
        setIsScanning(true);
        setError('');

        // Simulamos la autenticación por huella digital
        setTimeout(() => {
            // Simular éxito de autenticación (en una aplicación real, esto vendría del backend)
            const randomSuccess = Math.random() > 0.3; // 70% de éxito

            if (randomSuccess) {
                const mockUser = {
                    id_usuario: 1,
                    nombre: 'Usuario de Prueba',
                    id_huella: 12345
                };
                onLogin(mockUser);
            } else {
                setError('No se pudo reconocer la huella. Intente nuevamente.');
                setIsScanning(false);
            }
        }, 2000);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo">DeDuCracia</div>
                <div className="login-form">
                    <div className="login-fingerprint">
                        <div
                            className={`fingerprint-scanner ${isScanning ? 'scanning' : ''}`}
                            onClick={handleFingerprintScan}
                        >
                            {!isScanning ? (
                                <>
                                    <img src={fingerprintIcon} alt="Huella digital" className="fingerprint-icon" />
                                </>
                            ) : (
                                <div className="scanning-animation">
                                    <div className="scanning-line"></div>
                                    <img src={fingerprintIcon} alt="Escaneando" className="fingerprint-icon pulse" />
                                </div>
                            )}
                        </div>
                        <div className="fingerprint-message">
                            {isScanning ? 'Escaneando huella digital...' : 'Toque para escanear su huella digital'}
                        </div>
                        {error && <div className="error-message">{error}</div>}
                    </div>
                    <button
                        className="login-button"
                        onClick={handleFingerprintScan}
                        disabled={isScanning}
                    >
                        {isScanning ? 'Procesando...' : 'Iniciar Sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;