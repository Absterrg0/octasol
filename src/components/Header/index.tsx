"use client";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import Login from "../Login/Login";
import WalletManager  from "../link-wallet/button";
import { useSelector } from "react-redux";

type Props = {};

const Header = (props: Props) => {
  const user = useSelector((state: any) => state.user);
  return (
    <>
      <nav className="text-white fixed top-0 right-0 left-0 w-full h-20 flex justify-between items-center md:px-20 px-2 py-6 z-50  backdrop-blur-md">
        <div className="flex justify-center items-center">
          <Link href="/dashboard" passHref>
            <Image
              src="/octasolLandingLogo.png"
              alt="logo"
              width={80}
              height={80}
              placeholder="blur"
              blurDataURL="data:image/png;base64,..."
              priority={false}
              loading="lazy"
            />
          </Link>
          <span className="text-xs font-bold tracking-widest">Octasol Beta</span>
        </div>
        <div className="flex items-center gap-6">
          {user.githubId && <WalletManager></WalletManager>}
          <Login />
        </div>
      </nav>
    </>
  );
};

export default Header;
