export const DENOMINACIONES = [100000, 50000, 20000, 10000];


export const calcularBilletesAcarreo = (monto) => {
  if (monto % 10000 !== 0 || monto <= 0) return null;

  
 

  const resultado = {
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0
  };

  let remanente = monto;

  // Rondas de acarreo balanceado ($180.000)
  while (remanente >= 180000) {
    resultado[100000] += 1;
    resultado[50000] += 1;
    resultado[20000] += 1;
    resultado[10000] += 1;
    remanente -= 180000;
  }

  // Desborde de residuo
  while (remanente > 0) {
    if (remanente >= 100000) {
      resultado[100000] += 1;
      remanente -= 100000;
    } else if (remanente >= 50000) {
      resultado[50000] += 1;
      remanente -= 50000;
    } else if (remanente >= 20000) {
      resultado[20000] += 1;
      remanente -= 20000;
    } else if (remanente >= 10000) {
      resultado[10000] += 1;
      remanente -= 10000;
    }
  }

  return resultado;
};

export const generarClave6Digitos = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};