import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { calcularBilletesAcarreo, generarClave6Digitos, DENOMINACIONES } from './utils/cajeroUtils';

const CLAVE_FIJA_CUENTAS = '3145';

export default function App() {
  // Cantidad de billetes disponibles en la bóveda por denominación
  const [boveda, setBoveda] = useState({
    100000: 100,
    50000: 100,
    20000: 100,
    10000: 100
  });

  // Control del modal de administración para reabastecer el cajero
  const [modalBovedaAbierto, setModalBovedaAbierto] = useState(false);
  const [tempBoveda, setTempBoveda] = useState({ ...boveda });

  // Variables de navegación de la máquina de estados
  const [modo, setModo] = useState(null); 
  const [paso, setPaso] = useState('DATOS'); 


  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [claveIngresada, setClaveIngresada] = useState('');
  const [montoRetiro, setMontoRetiro] = useState(0);
  const [otroMonto, setOtroMonto] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  // Token de seguridad dinámico de Nequi
  const [claveDinamicaNequi, setClaveDinamicaNequi] = useState(generarClave6Digitos());
  const [temporizador, setTemporizador] = useState(60);

  // Almacenamiento del comprobante final y proyección predictiva
  const [resultadoBilletes, setResultadoBilletes] = useState(null);
  const [reporteNequiVector, setReporteNequiVector] = useState('');
  const [cantidadRetirosDeseados, setCantidadRetirosDeseados] = useState(5);




  const saldoTotalBoveda = DENOMINACIONES.reduce(
    (total, denom) => total + boveda[denom] * denom,
    0
  );

  // Temporizador para renovar el código dinámico de Nequi cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setTemporizador((prev) => {
        if (prev <= 1) {
          setClaveDinamicaNequi(generarClave6Digitos());
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  const reiniciarCajero = (mensaje = '') => {
    if (mensaje) {
      setMensajeError(mensaje);
      setPaso('ERROR');
    } else {
      setModo(null);
      setPaso('DATOS');
      setNumeroCuenta('');
      setClaveIngresada('');
      setMontoRetiro(0);
      setOtroMonto('');
      setMensajeError('');
      setResultadoBilletes(null);
      setReporteNequiVector('');
      setCantidadRetirosDeseados(5);
    }
  };

  // Valida en tiempo real que los números cumplan con las reglas de cada canal
  const handleNumeroCuentaChange = (e) => {
    const valor = e.target.value.replace(/\D/g, ''); 

    if (valor.length === 0) {
      setNumeroCuenta('');
      return;
    }

    
    if (modo === 'NEQUI') {
      if (valor[0] !== '3') {
        toast.error('Número Nequi inválido', {
          description: 'Las líneas móviles deben comenzar con el dígito 3.'
        });
        return;
      }
      if (valor.length <= 10) setNumeroCuenta(valor);
    } 
    

    else if (modo === 'AHORRO_MANO') {
      if (valor.length === 1 && valor[0] !== '0' && valor[0] !== '1') {
        toast.error('Primer dígito inválido', {
          description: 'Ahorro a la Mano solo puede iniciar en 0 o 1.'
        });
        return;
      }
      if (valor.length >= 2 && valor[1] !== '3') {
        toast.error('Segundo dígito inválido', {
          description: 'El segundo dígito debe ser obligatoriamente 3.'
        });
        return;
      }
      if (valor.length <= 11) setNumeroCuenta(valor);
    } 
   

    else if (modo === 'CUENTA_AHORROS') {
      if (valor.length <= 11) setNumeroCuenta(valor);
    }
  };

  // Controla la entrada de clave numérica limitando su longitud
  const handleClaveChange = (e) => {
    const valor = e.target.value.replace(/\D/g, '');
    const max = modo === 'NEQUI' ? 6 : 4;
    if (valor.length <= max) setClaveIngresada(valor);
  };

 

  const validarCredenciales = (e) => {
    e.preventDefault();

    if (modo === 'NEQUI') {
      if (numeroCuenta.length !== 10) {
        toast.error('Número incompleto', { description: 'El celular debe tener 10 dígitos.' });
        return;
      }
      if (claveIngresada !== claveDinamicaNequi) {
        toast.error('Clave dinámica incorrecta', { description: 'Digite la clave visible arriba a la derecha.' });
        return;
      }
    } else if (modo === 'AHORRO_MANO' || modo === 'CUENTA_AHORROS') {
      if (numeroCuenta.length !== 11) {
        toast.error('Número incompleto', { description: 'La cuenta debe tener 11 dígitos.' });
        return;
      }
      if (claveIngresada !== CLAVE_FIJA_CUENTAS) {
        toast.error('Clave incorrecta', { description: 'La clave de seguridad no es válida.' });
        return;
      }
    }

    toast.success('Credenciales validadas con éxito');
    setPaso('MONTO');
  };

 

  const ejecutarRetiro = (valor) => {
    const valorFinal = Number(valor);
    if (valorFinal > 1000000) {
      reiniciarCajero('El monto máximo permitido por retiro es de $1.000.000 COP. Inicie nuevamente.');
      return;
    }

 
    if (valorFinal > saldoTotalBoveda) {
      reiniciarCajero('El cajero no posee los fondos suficientes para este retiro. Inicie nuevamente.');
      return;
    }


    if (valorFinal % 10000 !== 0 || valorFinal <= 0) {
      reiniciarCajero(`El valor ingresado ($${valorFinal.toLocaleString('es-CO')}) no puede dispensarse con billetes de $10.000, $20.000, $50.000 o $100.000. Inicie nuevamente.`);
      return;
    }

    const desglose = calcularBilletesAcarreo(valorFinal);
    if (!desglose) {
      reiniciarCajero('Error al calcular el acarreo de billetes. Inicie nuevamente.');
      return;
    }

    for (const d of DENOMINACIONES) {
      if (boveda[d] < desglose[d]) {
        reiniciarCajero(`Fondos insuficientes: no hay suficientes billetes de $${d.toLocaleString('es-CO')}.`);
        return;
      }
    }

    // Descuenta los billetes entregados del stock físico
    setBoveda((prev) => ({
      100000: prev[100000] - desglose[100000],
      50000: prev[50000] - desglose[50000],
      20000: prev[20000] - desglose[20000],
      10000: prev[10000] - desglose[10000]
    }));

    setMontoRetiro(valorFinal);
    setResultadoBilletes(desglose);

    // En Nequi antepone el 0 al celular para armar el vector  de 11 dígitos
    if (modo === 'NEQUI') {
      setReporteNequiVector(`0${numeroCuenta}`);
    }

    toast.success('Retiro procesado con éxito');
    setPaso('REPORTE');
  };

  // Guarda la configuración manual del stock de billetes en la bóveda
  const guardarAjusteBoveda = (e) => {
    e.preventDefault();
    setBoveda({
      100000: Math.max(0, Number(tempBoveda[100000]) || 0),
      50000: Math.max(0, Number(tempBoveda[50000]) || 0),
      20000: Math.max(0, Number(tempBoveda[20000]) || 0),
      10000: Math.max(0, Number(tempBoveda[10000]) || 0)
    });
    setModalBovedaAbierto(false);
    toast.success('Bóveda configurada exitosamente');
  };

  return (
    <div className="min-h-screen bg-[#d9ceba] text-[#1a140e] flex flex-col items-center p-4 relative font-sans">
      {/* Trama sutil de fondo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: 'radial-gradient(#877660 1px, transparent 1px)',
          backgroundSize: '22px 22px'
        }}
      />

      <Toaster richColors position="top-center" theme="light" />

      {/* Widget flotante con la clave dinámica de Nequi */}
      {modo === 'NEQUI' && (
        <div className="fixed top-4 right-4 bg-[#ede2cf] border-2 border-[#a6947c] p-3 rounded-xl shadow-[3px_3px_0px_#93826b] flex items-center gap-3 z-40">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#4d3d2e] font-bold">Clave Dinámica</div>
            <div className="text-xl font-mono font-extrabold tracking-widest text-[#163824]">{claveDinamicaNequi}</div>
          </div>
          <div className="w-9 h-9 rounded-lg border-2 border-[#163824] flex items-center justify-center text-xs font-black text-[#163824] bg-[#d5c7b0]">
            {temporizador}s
          </div>
        </div>
      )}

      {/* Encabezado y monitor de inventario de la bóveda */}
      <header className="mt-4 mb-4 text-center w-full max-w-lg z-10">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">🏛️</span>
          <h1 className="text-2xl font-black tracking-tight text-[#17120c]">CAJERO AUTOMÁTICO</h1>
        </div>
        <p className="text-xs font-semibold text-[#453729]">Dispensación por Metodología de Acarreo</p>

        {/* Panel informativo del stock disponible */}
        <div className="mt-4 bg-[#ede3d1] border-2 border-[#a8967f] rounded-2xl p-4 text-xs shadow-[4px_4px_0px_#9b8971]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#c8baa6]">
            <div className="flex items-center gap-2">

              <span className="text-[#261d15] font-bold text-sm">Bóveda del Cajero:</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-[#163824] font-mono text-base tracking-tight">${saldoTotalBoveda.toLocaleString('es-CO')}</span>
              <button
                onClick={() => {
                  setTempBoveda({ ...boveda });
                  setModalBovedaAbierto(true);
                }}
                className="text-[11px] bg-[#d6c7af] hover:bg-[#c9b89e] text-[#1f1710] border-2 border-[#9b8971] px-3 py-1 rounded-lg transition-all font-bold shadow-[2px_2px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Editar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 font-mono">
            <div className="bg-[#dfd1bb] p-2 rounded-xl text-center border-2 border-dashed border-[#a8967f]">
              <span className="text-[#3b2f23] font-bold block text-[10px]">$100.000</span>
              <span className="text-[#163824] font-black text-sm">{boveda[100000]} und</span>
            </div>
            <div className="bg-[#dfd1bb] p-2 rounded-xl text-center border-2 border-dashed border-[#a8967f]">
              <span className="text-[#3b2f23] font-bold block text-[10px]">$50.000</span>
              <span className="text-[#163824] font-black text-sm">{boveda[50000]} und</span>
            </div>
            <div className="bg-[#dfd1bb] p-2 rounded-xl text-center border-2 border-dashed border-[#a8967f]">
              <span className="text-[#3b2f23] font-bold block text-[10px]">$20.000</span>
              <span className="text-[#163824] font-black text-sm">{boveda[20000]} und</span>
            </div>
            <div className="bg-[#dfd1bb] p-2 rounded-xl text-center border-2 border-dashed border-[#a8967f]">
              <span className="text-[#3b2f23] font-bold block text-[10px]">$10.000</span>
              <span className="text-[#163824] font-black text-sm">{boveda[10000]} und</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenedor principal donde se alternan las pantallas de la transacción */}
      <main className="w-full max-w-lg bg-[#ede3d1] border-2 border-[#a8967f] border-t-[6px] border-t-[#183b27] rounded-2xl p-6 shadow-[5px_5px_0px_#9b8971] z-10">
        
        {/* seleccion modalidad de retiro */}
        {!modo && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-[#382b1e] uppercase tracking-wider text-center mb-1">
              Seleccione el canal de retiro
            </h2>
            <div className="grid gap-3">
              <button
                onClick={() => setModo('NEQUI')}
                className="w-full py-3.5 px-4 bg-[#dfd1bb] hover:bg-[#d5c5ad] border-2 border-[#9b8971] rounded-xl text-left transition-all shadow-[3px_3px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex justify-between items-center group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#1a140e]">Retiro Nequi</span>
                </div>
                <span className="text-xs font-bold text-[#453729] bg-[#cfc0a7] px-2 py-0.5 rounded">10 dígitos</span>
              </button>

              <button
                onClick={() => setModo('AHORRO_MANO')}
                className="w-full py-3.5 px-4 bg-[#dfd1bb] hover:bg-[#d5c5ad] border-2 border-[#9b8971] rounded-xl text-left transition-all shadow-[3px_3px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex justify-between items-center group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#1a140e]">Ahorro a la Mano</span>
                </div>
                <span className="text-xs font-bold text-[#453729] bg-[#cfc0a7] px-2 py-0.5 rounded">Inicia en 0 o 1</span>
              </button>

              <button
                onClick={() => setModo('CUENTA_AHORROS')}
                className="w-full py-3.5 px-4 bg-[#dfd1bb] hover:bg-[#d5c5ad] border-2 border-[#9b8971] rounded-xl text-left transition-all shadow-[3px_3px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex justify-between items-center group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#1a140e]">Cuenta de Ahorros</span>
                </div>
                <span className="text-xs font-bold text-[#453729] bg-[#cfc0a7] px-2 py-0.5 rounded">11 dígitos</span>
              </button>
            </div>
          </div>
        )}

        {/*  Formulario de datos y autenticación */}
        {modo && paso === 'DATOS' && (
          <form onSubmit={validarCredenciales} className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b-2 border-[#c8baa6]">
              <h2 className="font-extrabold text-[#17120c] text-base">
                {modo === 'NEQUI' && 'Retiro Celular Nequi'}
                {modo === 'AHORRO_MANO' && 'Ahorro a la Mano'}
                {modo === 'CUENTA_AHORROS' && 'Cuenta de Ahorros'}
              </h2>
              <button
                type="button"
                onClick={() => reiniciarCajero()}
                className="text-xs font-bold text-[#8a2216] hover:text-[#5e140c] uppercase tracking-wider underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2b2117] mb-1.5">
                {modo === 'NEQUI' && 'Número de celular (10 dígitos, debe iniciar con 3):'}
                {modo === 'AHORRO_MANO' && 'Número de cuenta (11 dígitos, comienza en 0 o 1):'}
                {modo === 'CUENTA_AHORROS' && 'Número de cuenta (11 dígitos):'}
              </label>
              <input
                type="text"
                required
                value={numeroCuenta}
                onChange={handleNumeroCuentaChange}
                placeholder={modo === 'NEQUI' ? '3001234567' : modo === 'AHORRO_MANO' ? '03123456789' : '12345678901'}
                className="w-full bg-[#f4ebd9] border-2 border-[#9b8971] rounded-xl p-3 text-[#17120c] font-mono text-base font-bold tracking-wider focus:outline-none focus:border-[#183b27] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2b2117] mb-1.5">
                {modo === 'NEQUI' ? 'Clave dinámica (6 dígitos):' : 'Clave de 4 dígitos:'}
              </label>
              <input
                type="password"
                required
                value={claveIngresada}
                onChange={handleClaveChange}
                placeholder={modo === 'NEQUI' ? '••••••' : '••••'}
                className="w-full bg-[#f4ebd9] border-2 border-[#9b8971] rounded-xl p-3 text-[#17120c] font-mono text-base font-bold tracking-widest focus:outline-none focus:border-[#183b27] transition"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3.5 bg-[#183b27] hover:bg-[#112b1c] rounded-xl font-bold text-sm text-[#f4ebd9] transition-all shadow-[3px_3px_0px_#09170f] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase tracking-wider"
            >
              Continuar al Monto →
            </button>
          </form>
        )}

        {/*Selección de monto predeterminado u otro valor */}
        {modo && paso === 'MONTO' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b-2 border-[#c8baa6]">
              <h2 className="font-extrabold text-[#17120c] text-base">Seleccione el valor a retirar</h2>
              <button
                onClick={() => reiniciarCajero()}
                className="text-xs font-bold text-[#8a2216] hover:text-[#5e140c] uppercase tracking-wider underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[20000, 50000, 100000, 200000, 400000, 500000].map((monto) => (
                <button
                  key={monto}
                  onClick={() => ejecutarRetiro(monto)}
                  className="py-3.5 px-2 bg-[#dfd1bb] hover:bg-[#d5c5ad] border-2 border-[#9b8971] rounded-xl font-mono text-sm text-[#17120c] font-black transition-all shadow-[2px_2px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 text-center cursor-pointer"
                >
                  ${monto.toLocaleString('es-CO')}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t-2 border-[#c8baa6]">
              <label className="block text-xs font-bold text-[#2b2117] mb-1.5">Otro valor (Múltiplos de $10.000):</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="10000"
                  value={otroMonto}
                  onChange={(e) => setOtroMonto(e.target.value)}
                  placeholder="Ej: 650.
                  000 max 1.000.000"
                  className="flex-1 bg-[#f4ebd9] border-2 border-[#9b8971] rounded-xl p-2.5 text-[#17120c] font-mono text-sm font-bold focus:outline-none focus:border-[#183b27]"
                />
                <button
                  onClick={() => ejecutarRetiro(otroMonto)}
                  className="py-2.5 px-5 bg-[#183b27] hover:bg-[#112b1c] rounded-xl font-bold text-sm text-[#f4ebd9] transition-all shadow-[2px_2px_0px_#09170f] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase"
                >
                  Retirar
                </button>
              </div>
            </div>
          </div>
        )}

        {/*Comprobante de dispensación y módulo de simulación */}
        {paso === 'REPORTE' && resultadoBilletes && (
          <div className="space-y-4">
            <div className="text-center pb-2 border-b-2 border-[#c8baa6]">
              <div className="inline-block p-2 bg-[#c6dec9] border-2 border-[#183b27] rounded-full mb-1 text-[#183b27] font-black">
                ✓
              </div>
              <h2 className="text-lg font-black text-[#17120c]">Retiro Exitoso</h2>
              <p className="text-xs font-bold text-[#453729]">Comprobante de transacción dispensada</p>
            </div>

            {/* Vector  de Nequi */}
            {modo === 'NEQUI' && (
              <div className="bg-[#dfd1bb] p-3 rounded-xl border-2 border-[#9b8971]">
                <span className="text-[11px] font-bold text-[#3b2f23] block">Vector de reporte (11 dígitos):</span>
                <span className="text-base font-mono font-black text-[#183b27] tracking-wider">
                  {reporteNequiVector}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm py-1 border-b-2 border-[#c8baa6]">
              <span className="font-bold text-[#3b2f23]">Total dispensado:</span>
              <span className="font-mono font-black text-lg text-[#183b27]">${montoRetiro.toLocaleString('es-CO')}</span>
            </div>

            {/* Desglose de billetes físicos dispensados */}
            <div className="bg-[#dfd1bb] p-3 rounded-xl border-2 border-[#9b8971]">
              <span className="text-xs text-[#261d15] font-black block mb-2 uppercase tracking-wide">Billetes entregados (Acarreo):</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#f4ebd9] p-2.5 rounded-lg border-2 border-[#a8967f] flex justify-between items-center">
                  <span className="text-[#3b2f23] font-bold">$100k:</span>
                  <span className="text-[#183b27] font-black text-sm">{resultadoBilletes[100000]} uds</span>
                </div>
                <div className="bg-[#f4ebd9] p-2.5 rounded-lg border-2 border-[#a8967f] flex justify-between items-center">
                  <span className="text-[#3b2f23] font-bold">$50k:</span>
                  <span className="text-[#183b27] font-black text-sm">{resultadoBilletes[50000]} uds</span>
                </div>
                <div className="bg-[#f4ebd9] p-2.5 rounded-lg border-2 border-[#a8967f] flex justify-between items-center">
                  <span className="text-[#3b2f23] font-bold">$20k:</span>
                  <span className="text-[#183b27] font-black text-sm">{resultadoBilletes[20000]} uds</span>
                </div>
                <div className="bg-[#f4ebd9] p-2.5 rounded-lg border-2 border-[#a8967f] flex justify-between items-center">
                  <span className="text-[#3b2f23] font-bold">$10k:</span>
                  <span className="text-[#183b27] font-black text-sm">{resultadoBilletes[10000]} uds</span>
                </div>
              </div>
            </div>

            {/* Módulo predictivo: compara capacidad monetaria contra inventario físico */}
            {(() => {
              // 1. Capacidad máxima teórica según el dinero total restante
              const retirosPorSaldo = montoRetiro > 0 ? Math.floor(saldoTotalBoveda / montoRetiro) : 0;
              
              // 2. Capacidad real determinada por la denominación más escasa
              const retirosPorPapelMoneda = montoRetiro > 0
                ? Math.min(
                    ...DENOMINACIONES.map((d) =>
                      resultadoBilletes[d] > 0 ? Math.floor(boveda[d] / resultadoBilletes[d]) : Infinity
                    )
                  )
                : 0;

              const retiros = Math.max(1, Number(cantidadRetirosDeseados) || 1);

              // Billetes totales requeridos para cubrir la cantidad de retiros simulados
              const requeridos = {
                100000: resultadoBilletes[100000] * retiros,
                50000: resultadoBilletes[50000] * retiros,
                20000: resultadoBilletes[20000] * retiros,
                10000: resultadoBilletes[10000] * retiros
              };

              // Billetes faltantes que deben recargarse en la bóveda
              const faltantes = {
                100000: Math.max(0, requeridos[100000] - boveda[100000]),
                50000: Math.max(0, requeridos[50000] - boveda[50000]),
                20000: Math.max(0, requeridos[20000] - boveda[20000]),
                10000: Math.max(0, requeridos[10000] - boveda[10000])
              };

              const necesitaRecarga = Object.values(faltantes).some((cant) => cant > 0);

              return (
                <div className="bg-[#dfd1bb] border-2 border-[#9b8971] p-3.5 rounded-xl space-y-3">
                  {/* Resumen de capacidad para el monto seleccionado */}
                  <div className="bg-[#f4ebd9] border-2 border-[#a8967f] p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#261d15] font-black">
                        Capacidad actual para retiros de ${montoRetiro.toLocaleString('es-CO')}:
                      </span>
                      <span className="font-mono font-black text-[#183b27] text-sm">
                        {retirosPorPapelMoneda} retiros
                      </span>
                    </div>
                    <p className="text-[11px] text-[#453729] font-medium">
                      (Por saldo monetario alcanzaría para {retirosPorSaldo} retiros, limitado a {retirosPorPapelMoneda} por stock físico de billetes)
                    </p>
                  </div>

                  {/* Campo interactivo para simular otra cantidad de retiros */}
                  <div className="flex justify-between items-center pt-2 border-t-2 border-[#c8baa6]">
                    <span className="font-black text-[#17120c] text-xs uppercase">Simular otra cantidad:</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-[#2b2117]">N° retiros:</label>
                      <input
                        type="number"
                        min="1"
                        value={cantidadRetirosDeseados}
                        onChange={(e) => setCantidadRetirosDeseados(e.target.value)}
                        className="w-14 bg-[#f4ebd9] border-2 border-[#9b8971] rounded px-2 py-0.5 text-right font-mono text-xs font-black text-[#17120c] focus:outline-none focus:border-[#183b27]"
                      />
                    </div>
                  </div>

                  {/* Inventario proyectado para la simulación */}
                  <div>
                    <span className="text-[11px] font-bold text-[#3b2f23] block mb-1">
                      Billetes requeridos para <span className="font-black text-[#17120c]">{retiros}</span> retiros:
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
                      <div className="bg-[#f4ebd9] p-1.5 rounded text-center border-2 border-[#a8967f]">
                        <span className="text-[#453729] font-bold block text-[9px]">$100k</span>
                        <span className="text-[#17120c] font-black">{requeridos[100000]}</span>
                      </div>
                      <div className="bg-[#f4ebd9] p-1.5 rounded text-center border-2 border-[#a8967f]">
                        <span className="text-[#453729] font-bold block text-[9px]">$50k</span>
                        <span className="text-[#17120c] font-black">{requeridos[50000]}</span>
                      </div>
                      <div className="bg-[#f4ebd9] p-1.5 rounded text-center border-2 border-[#a8967f]">
                        <span className="text-[#453729] font-bold block text-[9px]">$20k</span>
                        <span className="text-[#17120c] font-black">{requeridos[20000]}</span>
                      </div>
                      <div className="bg-[#f4ebd9] p-1.5 rounded text-center border-2 border-[#a8967f]">
                        <span className="text-[#453729] font-bold block text-[9px]">$10k</span>
                        <span className="text-[#17120c] font-black">{requeridos[10000]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnóstico de abastecimiento */}
                  {necesitaRecarga ? (
                    <div className="bg-[#edd2cf] border-2 border-[#b54a3e] p-2.5 rounded-lg text-xs space-y-1">
                      <div className="text-[#8a2216] font-black text-[11px] flex items-center gap-1">
                        <span>⚠️ Bóveda insuficiente para {retiros} retiros</span>
                      </div>
                      <p className="text-[#591e17] font-semibold text-[10px]">Debe recargar con estos billetes adicionales:</p>
                      <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
                        <div className="bg-[#f7e6e4] p-1 rounded border border-[#b54a3e]">
                          <span className="text-[#8a2216] block text-[8px] font-bold">$100k</span>
                          <span className="text-[#17120c] font-black">+{faltantes[100000]}</span>
                        </div>
                        <div className="bg-[#f7e6e4] p-1 rounded border border-[#b54a3e]">
                          <span className="text-[#8a2216] block text-[8px] font-bold">$50k</span>
                          <span className="text-[#17120c] font-black">+{faltantes[50000]}</span>
                        </div>
                        <div className="bg-[#f7e6e4] p-1 rounded border border-[#b54a3e]">
                          <span className="text-[#8a2216] block text-[8px] font-bold">$20k</span>
                          <span className="text-[#17120c] font-black">+{faltantes[20000]}</span>
                        </div>
                        <div className="bg-[#f7e6e4] p-1 rounded border border-[#b54a3e]">
                          <span className="text-[#8a2216] block text-[8px] font-bold">$10k</span>
                          <span className="text-[#17120c] font-black">+{faltantes[10000]}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#c8e2cc] border-2 border-[#183b27] p-2 rounded-lg text-[11px] text-[#183b27] flex items-center gap-2 font-bold">
                      <span className="font-black text-xs">✓</span>
                      <span>Bóveda con existencias suficientes para los {retiros} retiros.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <button
              onClick={() => reiniciarCajero()}
              className="w-full py-3 bg-[#d6c7af] hover:bg-[#c9b89e] border-2 border-[#9b8971] rounded-xl font-bold text-xs text-[#17120c] transition-all shadow-[2px_2px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase tracking-wider"
            >
              Finalizar Transacción
            </button>
          </div>
        )}

        {/*  Error o fondos insuficientes */}
        {paso === 'ERROR' && (
          <div className="text-center space-y-4 py-4">
            <div className="text-3xl">⚠️</div>
            <h3 className="text-base font-black text-[#8a2216] uppercase">Operación No Permitida</h3>
            <p className="text-xs font-bold text-[#5e1911] bg-[#edd2cf] p-3 rounded-xl border-2 border-[#b54a3e]">
              {mensajeError}
            </p>
            <button
              onClick={() => reiniciarCajero()}
              className="w-full py-3 bg-[#8a2216] hover:bg-[#6e1910] rounded-xl font-bold text-xs text-[#f4ebd9] transition-all shadow-[3px_3px_0px_#420f0a] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase tracking-wider"
            >
              Volver al Inicio
            </button>
          </div>
        )}
      </main>

      {/*  reabastecimiento manual de la bóveda */}
      {modalBovedaAbierto && (
        <div className="fixed inset-0 bg-[#17120c]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#ede3d1] border-2 border-[#a8967f] rounded-2xl p-5 w-full max-w-sm shadow-[6px_6px_0px_#17120c] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b-2 border-[#c8baa6]">
              <h3 className="font-black text-[#17120c] text-sm uppercase">Abastecer Bóveda</h3>
              <button
                onClick={() => setModalBovedaAbierto(false)}
                className="text-[#453729] hover:text-[#17120c] text-sm cursor-pointer font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarAjusteBoveda} className="space-y-3">
              {DENOMINACIONES.map((denom) => (
                <div key={denom} className="flex justify-between items-center text-xs">
                  <label className="text-[#261d15] font-mono font-bold">
                    Billetes ${denom.toLocaleString('es-CO')}:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tempBoveda[denom]}
                    onChange={(e) =>
                      setTempBoveda({
                        ...tempBoveda,
                        [denom]: e.target.value
                      })
                    }
                    className="w-24 bg-[#f4ebd9] border-2 border-[#9b8971] rounded-lg p-1.5 text-right font-mono font-bold text-[#17120c] text-xs focus:outline-none focus:border-[#183b27]"
                  />
                </div>
              ))}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalBovedaAbierto(false)}
                  className="w-1/2 py-2.5 bg-[#d6c7af] hover:bg-[#c9b89e] border-2 border-[#9b8971] rounded-xl text-[#17120c] text-xs font-bold transition-all shadow-[2px_2px_0px_#9b8971] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#183b27] hover:bg-[#112b1c] rounded-xl text-[#f4ebd9] text-xs font-bold transition-all shadow-[2px_2px_0px_#09170f] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer uppercase"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}