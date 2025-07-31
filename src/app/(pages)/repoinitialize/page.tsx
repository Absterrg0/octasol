// import { RepoInitializeForm } from "@/components/RepoInitializeForm"
import { Meteors } from "@/components/ui/metors"
import RepoInitializeForm from "@/components/RepoInitializeForm"

const Repoinitialize = () => {
  return (
    <>
      <div className="flex flex-col gap-4  w-full justify-start items-center relative z-10 pt-4 bg-black">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Meteors number={25} className="z-0 " />

          {/* Main Content */}
          <div className="w-full relative z-30">
            <RepoInitializeForm />
          </div>
        </div>
      </div>
    </>
  )
}

export default Repoinitialize
