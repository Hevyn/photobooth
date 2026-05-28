import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 폰 검증용 LAN IP 접근 허용 (Next 16 의 dev origin 검증 우회).
  // .env.local 의 NEXT_DEV_LAN_ORIGIN 에 노트북 LAN IP 박으면 자동 적용.
  allowedDevOrigins: process.env.NEXT_DEV_LAN_ORIGIN
    ? [process.env.NEXT_DEV_LAN_ORIGIN]
    : [],
};

export default nextConfig;
