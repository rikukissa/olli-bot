from textgenrnn import textgenrnn

textgen = textgenrnn('./textgenrnn_weights.hdf5')
# textgen = textgenrnn()
# textgen.train_from_file('data.txt', num_epochs=1)
# textgen.generate(interactive=True, top_n=5)
textgen.generate(30, temperature=0.4, max_gen_length=100)