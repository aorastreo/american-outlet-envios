import { CheckCircle, ClipboardCheck, MapPin, Package, Send, Truck } from "lucide-react";
import type { TimelineStep } from "@/lib/timeline";

function StepIcon({ status }: { status: string }) {
  const className = "w-5 h-5";
  if (status === "RECIBIDO_EN_DESTINO") return <CheckCircle className={className} />;
  if (status === "RECIBIDO_EN_BODEGA") return <ClipboardCheck className={className} />;
  if (status === "ENVIADO_A_BODEGA") return <Send className={className} />;
  if (status === "EN_PARADA") return <MapPin className={className} />;
  if (status === "CREADO") return <Package className={className} />;
  return <Truck className={className} />;
}

export function ShipmentProgress({
  steps,
  currentIndex,
}: {
  steps: TimelineStep[];
  currentIndex: number;
}) {
  if (steps.length === 0) return null;

  return (
    <>
      <ol className="md:hidden">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          return (
            <li key={`${step.status}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${
                    isCompleted
                      ? "bg-[#C8102E] border-[#C8102E] text-white"
                      : "bg-white border-[#D4D4D4] text-[#A3A3A3]"
                  } ${isCurrent ? "ring-4 ring-[#C8102E]/20" : ""}`}
                >
                  <StepIcon status={step.status} />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-4 my-1 ${index < currentIndex ? "bg-[#C8102E]" : "bg-[#E5E5E5]"}`} />
                )}
              </div>
              <div className={isLast ? "pt-2" : "pt-2 pb-4"}>
                <p className={`text-sm font-medium leading-tight ${isCompleted ? "text-[#1A1A1A]" : "text-[#A3A3A3]"}`}>
                  {step.label}
                </p>
                {step.desc && (
                  <p className={`text-xs mt-0.5 ${isCompleted ? "text-[#525252]" : "text-[#A3A3A3]"}`}>
                    {step.desc}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="relative hidden md:block">
        <div className="flex items-start justify-between">
          {steps.map((step, index) => {
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={`${step.status}-${index}`} className="flex flex-col items-center relative z-10 flex-1 px-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    isCompleted
                      ? "bg-[#C8102E] border-[#C8102E] text-white"
                      : "bg-white border-[#D4D4D4] text-[#A3A3A3]"
                  } ${isCurrent ? "ring-4 ring-[#C8102E]/20" : ""}`}
                >
                  <StepIcon status={step.status} />
                </div>
                <span className={`text-xs mt-3 text-center font-medium ${isCompleted ? "text-[#1A1A1A]" : "text-[#A3A3A3]"}`}>
                  {step.label}
                </span>
                {step.desc && (
                  <span className={`text-[10px] text-center ${isCompleted ? "text-[#8A8A8A]" : "text-[#A3A3A3]"}`}>
                    {step.desc}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute top-6 left-6 right-6 h-1 bg-[#F0F0F0] -z-0">
          <div
            className="h-full bg-[#C8102E]"
            style={{
              width: steps.length > 1 ? `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` : "0%",
            }}
          />
        </div>
      </div>
    </>
  );
}
