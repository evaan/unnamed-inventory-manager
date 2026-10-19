interface MainPageProps {
  token: string;
  onLogout: () => void;
}

export const MainPage = ({ onLogout }: MainPageProps) => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Inventory Dashboard</h1>
        <button
          onClick={onLogout}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Log Out
        </button>
      </header>
      <main>
        <p>Authenticated Session Active</p>
      </main>
    </div>
  );
};
