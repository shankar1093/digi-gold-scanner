import React from 'react';


const Header = () => {
    return (
        <header className="bg-gray-800 text-white">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between py-2">
                    <h1 className="text-2xl font-bold">Mangalore Jewellery Works</h1>
                    <a href="#" className="hover:underline text-2xl">
                        Contact
                    </a>
                </div>
            </div>
        </header>
    );
}

export default Header;