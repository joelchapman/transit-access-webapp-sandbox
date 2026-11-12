import { mapColors } from "@/styles/mapColors";

export const complexBoundaryProps = {
    id: "active-complex-boundary-layer",
    type: "fill",
    source: "active-complex-boundary",
    paint: {
      "fill-color": mapColors.complexHighlight,      
      "fill-opacity": 0.2,          
    },
  };
  