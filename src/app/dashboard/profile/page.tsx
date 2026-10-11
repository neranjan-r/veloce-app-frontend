import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-4xl items-center justify-center">
      <UserProfile />
    </div>
  );
}
