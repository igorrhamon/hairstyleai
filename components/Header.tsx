import React from 'react';
import { SparklesIcon } from './Icons';

export const Header: React.FC = () => {
    return (
        <header className="w-full max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3">
                <SparklesIcon className="w-8 h-8 text-purple-400" />
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                    Provador de Penteados
                </h1>
            </div>
            <p className="mt-3 text-lg text-gray-400">
                Envie sua foto e descreva o penteado dos seus sonhos. A IA vai criar o seu novo visual.
            </p>
        </header>
    );
};
