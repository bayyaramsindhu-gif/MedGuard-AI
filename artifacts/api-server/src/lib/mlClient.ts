const ML_API_URL = "https://itchy-ties-fry.loca.lt";
export interface MLPrediction {
  deterioration_probability: number;
  risk_percentage: number;
  risk_level: "STABLE" | "WATCH" | "WARNING" | "CRITICAL";
}

export interface MLVitalsInput {
  hour_from_admission: number;
  heart_rate: number;
  respiratory_rate: number;
  spo2_pct: number;
  temperature_c: number;
  systolic_bp: number;
  age: number;
}

export async function predictDeterioration(
  input: MLVitalsInput,
): Promise<MLPrediction> {
  const response = await fetch(`${ML_API_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      `MedGuard ML API returned ${response.status}`,
    );
  }

  return (await response.json()) as MLPrediction;
}